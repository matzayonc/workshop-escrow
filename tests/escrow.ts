import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { confirmTransaction, makeKeypairs } from "@solana-developers/helpers";
import { assert } from "chai";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { randomBytes } from "crypto";

describe("escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Escrow as Program<Escrow>;
  const [alice, bob, tokenMintA, tokenMintB] = makeKeypairs(4);

  const offerId = new BN(0);
  const offerAddress = PublicKey.findProgramAddressSync(
    [
      Buffer.from("offer"),
      alice.publicKey.toBuffer(),
      offerId.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  )[0];

  const accounts: Record<string, PublicKey> = {
    tokenProgram: TOKEN_PROGRAM_ID,
  };

  let tokenA = Mint;

  const tokenAOfferedAmount = new BN(1_000_000);
  const tokenBWantedAmount = new BN(1_000_000);

  before(
    "Creates Alice and Bob accounts, 2 token mints, and associated token accounts for both tokens for both users",
    async () => {
      const [
        aliceTokenAccountA,
        aliceTokenAccountB,
        bobTokenAccountA,
        bobTokenAccountB,
      ] = [alice, bob]
        .map((keypair) =>
          [tokenMintA, tokenMintB].map((mint) =>
            getAssociatedTokenAddressSync(
              mint.publicKey,
              keypair.publicKey,
              false,
              TOKEN_PROGRAM_ID
            )
          )
        )
        .flat();

      // Airdrops to users, and creates two tokens mints 'A' and 'B'"
      let minimumLamports = await getMinimumBalanceForRentExemptMint(
        program.provider.connection
      );

      const sendSolInstructions: Array<TransactionInstruction> = [
        alice,
        bob,
      ].map((account) =>
        SystemProgram.transfer({
          fromPubkey: program.provider.publicKey,
          toPubkey: account.publicKey,
          lamports: 10 * LAMPORTS_PER_SOL,
        })
      );

      const createMintInstructions: Array<TransactionInstruction> = [
        tokenMintA,
        tokenMintB,
      ].map((mint) =>
        SystemProgram.createAccount({
          fromPubkey: program.provider.publicKey,
          newAccountPubkey: mint.publicKey,
          lamports: minimumLamports,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      // Make tokenA and tokenB mints, mint tokens and create ATAs
      const mintTokensInstructions: Array<TransactionInstruction> = [
        {
          mint: tokenMintA.publicKey,
          authority: alice.publicKey,
          ata: aliceTokenAccountA,
        },
        {
          mint: tokenMintB.publicKey,
          authority: bob.publicKey,
          ata: bobTokenAccountB,
        },
      ].flatMap((mintDetails) => [
        createInitializeMint2Instruction(
          mintDetails.mint,
          6,
          mintDetails.authority,
          null,
          TOKEN_PROGRAM_ID
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          program.provider.publicKey,
          mintDetails.ata,
          mintDetails.authority,
          mintDetails.mint,
          TOKEN_PROGRAM_ID
        ),
        createMintToInstruction(
          mintDetails.mint,
          mintDetails.ata,
          mintDetails.authority,
          1_000_000_000,
          [],
          TOKEN_PROGRAM_ID
        ),
      ]);

      // Add all these instructions to our transaction
      let tx = new Transaction();
      tx.instructions = [
        ...sendSolInstructions,
        ...createMintInstructions,
        ...mintTokensInstructions,
      ];

      const transactionSignature = await program.provider.sendAndConfirm(tx, [
        tokenMintA,
        tokenMintB,
        alice,
        bob,
      ]);

      // // Save the accounts for later use
      accounts.maker = alice.publicKey;
      accounts.taker = bob.publicKey;
      accounts.tokenMintA = tokenMintA.publicKey;
      accounts.makerTokenAccountA = aliceTokenAccountA;
      accounts.takerTokenAccountA = bobTokenAccountA;
      accounts.tokenMintB = tokenMintB.publicKey;
      accounts.makerTokenAccountB = aliceTokenAccountB;
      accounts.takerTokenAccountB = bobTokenAccountB;
    }
  );

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });

  it("Can create a new escrow account", async () => {
    // Pick a random ID for the offer we'll make
    const offerId = getRandomBigNumber();

    // Then determine the account addresses we'll use for the offer and the vault
    const offer = PublicKey.findProgramAddressSync(
      [
        Buffer.from("offer"),
        accounts.maker.toBuffer(),
        offerId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];

    const vault = getAssociatedTokenAddressSync(
      accounts.tokenMintA,
      offer,
      true,
      TOKEN_PROGRAM_ID
    );

    accounts.offer = offer;
    accounts.vault = vault;

    // const balance_a_before =
    //   await program.provider.connection.getTokenAccountBalance(
    //     accounts.makerTokenAccountA
    //   );

    // assert.equal(balance_a_before.value.amount, "1000000000");

    const transactionSignature = await program.methods
      .makeOffer(offerId, tokenAOfferedAmount, tokenBWantedAmount)
      .accounts({ ...accounts })
      .signers([alice])
      .rpc();

    await confirmTransaction(program.provider.connection, transactionSignature);

    // Check our vault contains the tokens offered
    const vaultBalanceResponse =
      await program.provider.connection.getTokenAccountBalance(vault);
    const vaultBalance = new BN(vaultBalanceResponse.value.amount);

    // Check our Offer account contains the correct data
    const offerAccount = await program.account.offer.fetch(offer);

    assert(offerAccount.maker.equals(alice.publicKey));
    assert(offerAccount.tokenMintA.equals(accounts.tokenMintA));
    assert(offerAccount.tokenMintB.equals(accounts.tokenMintB));
    assert(offerAccount.tokenBWantedAmount.eq(tokenBWantedAmount));

    // TODO: Next week
    // assert.equal(vaultBalance.toNumber(), tokenAOfferedAmount.toNumber());
    // });

    // it("Can take an offer", async () => {
    // Call take offer instruction
    await sleep(5000);

    const tx = await program.methods
      .takeOffer()
      .accounts({
        taker: bob.publicKey,
        maker: alice.publicKey,
        tokenMintA: accounts.tokenMintA,
        tokenMintB: accounts.tokenMintB,
        takerTokenAccountA: accounts.takerTokenAccountA,
        takerTokenAccountB: accounts.takerTokenAccountB,
        makerTokenAccountB: accounts.makerTokenAccountB,
        vault: accounts.vault,
        offer: accounts.offer,
      })
      .signers([bob])
      .rpc();

    const createdOffer = await program.account.offer.fetchNullable(
      offerAddress
    );

    assert.isNull(createdOffer);
  });

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const getRandomBigNumber = (size: number = 8) => {
    return new BN(randomBytes(size));
  };
});
