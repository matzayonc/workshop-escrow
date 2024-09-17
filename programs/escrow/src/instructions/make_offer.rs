use anchor_lang::{context, prelude::*, Bump};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{Offer, ANCHOR_DESCRIMINATOR, OFFER_SEED};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct MakeOffer<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub token_mint_a: InterfaceAccount<'info, Mint>,

    #[account(mint::token_program = token_program)]
    pub token_mint_b: InterfaceAccount<'info, Mint>,

    #[account(mut,
        associated_token::mint = token_mint_a,
        associated_token::authority = maker,
        associated_token::token_program = token_program
    )]
    pub maker_token_account_a: InterfaceAccount<'info, TokenAccount>,

    #[account(init, 
        payer = maker, 
        space = ANCHOR_DESCRIMINATOR + Offer::INIT_SPACE,
        seeds = [OFFER_SEED, maker.key().as_ref(), &id.to_le_bytes()],
        bump
    )]
    offer: Account<'info, Offer>,

    #[account(init,
        payer = maker,
        associated_token::mint = token_mint_a,
        associated_token::authority = offer,
        associated_token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn make_offer(ctx: Context<MakeOffer>, id: u64, wanted_amount: u64) -> Result<()> {

    ctx.accounts.offer.set_inner(Offer {
        id,
        maker: ctx.accounts.maker.key(),
        token_mint_a: ctx.accounts.token_mint_a.key(),
        token_mint_b: ctx.accounts.token_mint_b.key(),
        token_b_wanted_amount: wanted_amount,
        bump: ctx.bumps.offer,
    });

    Ok(())
}

pub fn send_tokens_to_vault(
    ctx: &Context<MakeOffer>,
    amount: u64,
) -> Result<()> {

    let transfer_accounts = TransferChecked {
        from: ctx.accounts.maker_token_account_a.to_account_info(),
        mint: ctx.accounts.token_mint_a.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.maker.to_account_info(),
    };

    let cpi_context = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_accounts);

    transfer_checked(cpi_context, amount, ctx.accounts.token_mint_a.decimals)?;

    Ok(())
}

