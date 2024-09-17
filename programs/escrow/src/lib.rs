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

    pub fn make_offer(
        ctx: Context<MakeOffer>,
        id: u64,
        token_a_offered_amount: u64,
        token_b_wanted_amount: u64,
    ) -> Result<()> {
        send_tokens_to_vault(&ctx, token_a_offered_amount)?;
        make_offer::make_offer(ctx, id, token_b_wanted_amount)
    }

    pub fn take_offer(ctx: Context<TakeOffer>) -> Result<()> {
        take_offer::take_offer(ctx)
    }
}
