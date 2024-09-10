use anchor_lang::prelude::*;

use crate::Offer;

#[derive(Accounts)]
pub struct TakeOffer<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,

    #[account(mut)]
    pub maker: SystemAccount<'info>,

    #[account(mut, close = maker,
        has_one = maker,
        seeds = [b"offer", maker.key().as_ref()],
        bump = offer.bump
    )]
    offer: Account<'info, Offer>,
}
