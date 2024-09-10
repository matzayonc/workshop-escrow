use anchor_lang::{prelude::*, Bump};

use crate::{Offer, ANCHOR_DESCRIMINATOR, OFFER_SEED};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct MakeOffer<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(init, 
        payer = maker, 
        space = ANCHOR_DESCRIMINATOR + Offer::INIT_SPACE,
        seeds = [OFFER_SEED, maker.key().as_ref(), &id.to_le_bytes()],
        bump
    )]
    offer: Account<'info, Offer>,

    /// CHECK:
    pub token_mint_a: AccountInfo<'info>,
    /// CHECK:
    pub token_mint_b: AccountInfo<'info>,

    pub system_program: Program<'info, System>
}

pub fn make_offer(ctx: Context<MakeOffer>, id: u64, wanted_amount: u64) -> Result<()> {
    ctx.accounts.offer.set_inner(Offer {
        id, 
        maker: ctx.accounts.maker.key(), 
        token_mint_a: ctx.accounts.token_mint_a.key(), 
        token_mint_b: ctx.accounts.token_mint_b.key(),
        token_b_wanted_amount: wanted_amount, 
        bump: ctx.bumps.offer 
    });

    Ok(())
}