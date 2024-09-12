import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { makeKeypairs } from "@solana-developers/helpers";
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
      // accounts.maker = alice.publicKey;
      // accounts.taker = bob.publicKey;
      // accounts.tokenMintA = tokenMintA.publicKey;
      // accounts.makerTokenAccountA = aliceTokenAccountA;
      // accounts.takerTokenAccountA = bobTokenAccountA;
      // accounts.tokenMintB = tokenMintB.publicKey;
      // accounts.makerTokenAccountB = aliceTokenAccountB;
      // accounts.takerTokenAccountB = bobTokenAccountB;
    }
  );

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });

  it("Can create a new escrow account", async () => {
    const tokenMintA = new Keypair().publicKey;
    const tokenMintB = new Keypair().publicKey;

    // Call make offer instruction and create a new offer account
    const tx = await program.methods
      .makeOffer(new BN(0), new BN(100))
      .accounts({
        offer: offerAddress,
        maker: alice.publicKey,
        tokenMintA,
        tokenMintB,
      })
      .signers([alice])
      .rpc();

    // Fetch the created offer account
    const createdOffer = await program.account.offer.fetch(offerAddress);

    assert.isNotNull(createdOffer);
    assert.equal(createdOffer.tokenBWantedAmount.toNumber(), 100);
    assert.equal(createdOffer.maker.toBase58(), alice.publicKey.toBase58());
  });

  it("Can take an offer", async () => {
    // Call take offer instruction
    const tx = await program.methods
      .takeOffer()
      .accounts({
        offer: offerAddress,
        taker: bob.publicKey,
        maker: alice.publicKey,
      })
      .signers([bob])
      .rpc();

    const createdOffer = await program.account.offer.fetchNullable(
      offerAddress
    );

    assert.isNull(createdOffer);
  });
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
