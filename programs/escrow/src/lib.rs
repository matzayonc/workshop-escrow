pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("Ajth9mFMKb5n4Fc3FrzSbG6vv4u69xcLJHy2A5TjAE9P");

#[program]
pub mod escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }

    pub fn make_offer(ctx: Context<MakeOffer>, id: u64, wanted_amount: u64) -> Result<()> {
        make_offer::make_offer(ctx, id, wanted_amount)
    }

    pub fn take_offer(ctx: Context<TakeOffer>) -> Result<()> {
        take_offer::take_offer(ctx)
    }
}
