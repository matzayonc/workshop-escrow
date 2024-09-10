import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { PublicKey, Keypair } from "@solana/web3.js";
import { assert } from "chai";

describe("escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Escrow as Program<Escrow>;
  const maker = new Keypair();
  const taker = new Keypair();
  const offerId = new BN(0);
  const offerAddress = PublicKey.findProgramAddressSync(
    [
      Buffer.from("offer"),
      maker.publicKey.toBuffer(),
      offerId.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  )[0];

  before(async () => {
    for (let keypair of [maker, taker]) {
      await program.provider.connection.requestAirdrop(
        keypair.publicKey,
        1000000000
      );
      await program.provider.connection.requestAirdrop(
        keypair.publicKey,
        1000000000
      );
      await sleep(1000);
      const balance = await program.provider.connection.getBalance(
        keypair.publicKey
      );
      assert.equal(balance, 1000000000);
    }
  });

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
        maker: maker.publicKey,
        tokenMintA,
        tokenMintB,
      })
      .signers([maker])
      .rpc();

    // Fetch the created offer account
    const createdOffer = await program.account.offer.fetch(offerAddress);

    assert.isNotNull(createdOffer);
    assert.equal(createdOffer.tokenBWantedAmount.toNumber(), 100);
    assert.equal(createdOffer.maker.toBase58(), maker.publicKey.toBase58());
  });

  it("Can take an offer", async () => {
    // Call take offer instruction
    const tx = await program.methods
      .takeOffer()
      .accounts({
        offer: offerAddress,
        taker: taker.publicKey,
        maker: maker.publicKey,
      })
      .signers([taker])
      .rpc();

    const createdOffer = await program.account.offer.fetchNullable(
      offerAddress
    );

    assert.isNull(createdOffer);
  });
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
