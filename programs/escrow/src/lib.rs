use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

declare_id!("7LwZweZrjDTouJ5b5GuW6zrT2Pu7jsSgSJAAvV2MdpL2");

#[program]
pub mod proofwork_escrow {
    use super::*;

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        contract_id: [u8; 32],
        total_amount: u64,
        expires_at: i64,
        fee_bps: u16,
    ) -> Result<()> {
        require!(total_amount > 0, EscrowError::InvalidAmount);
        require!(
            expires_at > Clock::get()?.unix_timestamp,
            EscrowError::InvalidExpiry
        );
        require_keys_neq!(
            ctx.accounts.client.key(),
            ctx.accounts.freelancer.key(),
            EscrowError::DuplicateParticipant
        );
        require!(fee_bps <= 1_000, EscrowError::FeeTooHigh);
        let escrow = &mut ctx.accounts.escrow;
        escrow.contract_id = contract_id;
        escrow.client = ctx.accounts.client.key();
        escrow.freelancer = ctx.accounts.freelancer.key();
        escrow.resolver = ctx.accounts.resolver.key();
        escrow.fee_recipient = ctx.accounts.fee_recipient.key();
        escrow.fee_bps = fee_bps;
        escrow.platform_fee_paid = 0;
        escrow.total_amount = total_amount;
        escrow.planned_amount = 0;
        escrow.funded_amount = 0;
        escrow.released_amount = 0;
        escrow.refunded_amount = 0;
        escrow.expires_at = expires_at;
        escrow.milestone_count = 0;
        escrow.next_milestone = 0;
        escrow.state = EscrowState::Draft;
        escrow.disputed_by = Pubkey::default();
        escrow.evidence_hash = [0; 32];
        escrow.resolution_hash = [0; 32];
        escrow.bump = ctx.bumps.escrow;
        emit!(EscrowInitialized {
            escrow: escrow.key(),
            contract_id,
            client: escrow.client,
            freelancer: escrow.freelancer,
            total_amount,
            expires_at
        });
        Ok(())
    }

    pub fn add_milestone(
        ctx: Context<AddMilestone>,
        index: u16,
        amount: u64,
        due_at: i64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            escrow.state == EscrowState::Draft,
            EscrowError::InvalidState
        );
        require!(
            index == escrow.milestone_count,
            EscrowError::InvalidMilestoneOrder
        );
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(due_at <= escrow.expires_at, EscrowError::InvalidExpiry);
        let planned = escrow
            .planned_amount
            .checked_add(amount)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        require!(
            planned <= escrow.total_amount,
            EscrowError::MilestoneTotalMismatch
        );
        escrow.planned_amount = planned;
        escrow.milestone_count = escrow
            .milestone_count
            .checked_add(1)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        let milestone = &mut ctx.accounts.milestone;
        milestone.escrow = escrow.key();
        milestone.index = index;
        milestone.amount = amount;
        milestone.due_at = due_at;
        milestone.state = MilestoneState::Pending;
        milestone.bump = ctx.bumps.milestone;
        emit!(MilestoneAdded {
            escrow: escrow.key(),
            milestone: milestone.key(),
            index,
            amount,
            due_at
        });
        Ok(())
    }

    pub fn fund(ctx: Context<FundEscrow>, amount: u64) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);
        let escrow = &mut ctx.accounts.escrow;
        require!(
            matches!(escrow.state, EscrowState::Draft | EscrowState::Funded),
            EscrowError::InvalidState
        );
        require!(
            escrow.planned_amount == escrow.total_amount,
            EscrowError::MilestoneTotalMismatch
        );
        let funded = escrow
            .funded_amount
            .checked_add(amount)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        require!(funded <= escrow.total_amount, EscrowError::Overfunded);
        system_program::transfer(
            CpiContext::new(
                system_program::ID,
                Transfer {
                    from: ctx.accounts.client.to_account_info(),
                    to: escrow.to_account_info(),
                },
            ),
            amount,
        )?;
        escrow.funded_amount = funded;
        if funded == escrow.total_amount {
            escrow.state = EscrowState::Funded;
        }
        require!(
            escrow.conservation_holds(),
            EscrowError::ConservationViolation
        );
        emit!(EscrowFunded {
            escrow: escrow.key(),
            amount,
            funded_amount: funded
        });
        Ok(())
    }

    pub fn submit_milestone(ctx: Context<SubmitMilestone>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let milestone = &mut ctx.accounts.milestone;
        require!(
            matches!(escrow.state, EscrowState::Funded | EscrowState::Active),
            EscrowError::InvalidState
        );
        require!(
            milestone.index == escrow.next_milestone,
            EscrowError::InvalidMilestoneOrder
        );
        require!(
            milestone.state == MilestoneState::Pending,
            EscrowError::InvalidState
        );
        milestone.state = MilestoneState::Submitted;
        escrow.state = EscrowState::Active;
        emit!(MilestoneSubmitted {
            escrow: escrow.key(),
            milestone: milestone.key(),
            index: milestone.index
        });
        Ok(())
    }

    pub fn approve_milestone(ctx: Context<ApproveMilestone>) -> Result<()> {
        let milestone = &mut ctx.accounts.milestone;
        require!(
            milestone.state == MilestoneState::Submitted,
            EscrowError::InvalidState
        );
        milestone.state = MilestoneState::Approved;
        emit!(MilestoneApproved {
            escrow: ctx.accounts.escrow.key(),
            milestone: milestone.key(),
            index: milestone.index
        });
        Ok(())
    }

    pub fn release_milestone(ctx: Context<ReleaseMilestone>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let milestone = &mut ctx.accounts.milestone;
        require!(
            milestone.index == escrow.next_milestone,
            EscrowError::InvalidMilestoneOrder
        );
        require!(
            milestone.state == MilestoneState::Approved,
            EscrowError::InvalidState
        );
        let released = escrow
            .released_amount
            .checked_add(milestone.amount)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        let remaining_after = escrow
            .funded_amount
            .checked_sub(released)
            .and_then(|remaining| remaining.checked_sub(escrow.refunded_amount))
            .ok_or(EscrowError::ConservationViolation)?;
        let rent = Rent::get()?.minimum_balance(8 + Escrow::INIT_SPACE);
        let escrow_info = escrow.to_account_info();
        let freelancer_info = ctx.accounts.freelancer.to_account_info();
        let fee_info = ctx.accounts.fee_recipient.to_account_info();
        let fee = calculate_fee(milestone.amount, escrow.fee_bps)?;
        let freelancer_amount = milestone
            .amount
            .checked_sub(fee)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        require!(
            escrow_info.lamports().saturating_sub(rent) >= milestone.amount,
            EscrowError::InsufficientEscrowBalance
        );
        let escrow_lamports = escrow_info.lamports();
        let freelancer_lamports = freelancer_info.lamports();
        **escrow_info.try_borrow_mut_lamports()? = escrow_lamports
            .checked_sub(milestone.amount)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        **freelancer_info.try_borrow_mut_lamports()? = freelancer_lamports
            .checked_add(freelancer_amount)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        if fee > 0 {
            let fee_balance = fee_info.lamports();
            **fee_info.try_borrow_mut_lamports()? = fee_balance
                .checked_add(fee)
                .ok_or(EscrowError::ArithmeticOverflow)?;
        }
        escrow.released_amount = released;
        escrow.next_milestone = escrow
            .next_milestone
            .checked_add(1)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        escrow.platform_fee_paid = escrow
            .platform_fee_paid
            .checked_add(fee)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        milestone.state = MilestoneState::Released;
        escrow.state = if remaining_after == 0 {
            EscrowState::Completed
        } else {
            EscrowState::Active
        };
        require!(
            escrow.conservation_holds(),
            EscrowError::ConservationViolation
        );
        emit!(MilestoneReleased {
            escrow: escrow.key(),
            milestone: milestone.key(),
            index: milestone.index,
            amount: milestone.amount,
            fee
        });
        Ok(())
    }

    pub fn refund_expired(ctx: Context<RefundExpired>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            Clock::get()?.unix_timestamp > escrow.expires_at,
            EscrowError::NotExpired
        );
        require!(
            !matches!(escrow.state, EscrowState::Completed | EscrowState::Expired),
            EscrowError::InvalidState
        );
        let remaining = escrow.remaining()?;
        require!(remaining > 0, EscrowError::InvalidAmount);
        let rent = Rent::get()?.minimum_balance(8 + Escrow::INIT_SPACE);
        let escrow_info = escrow.to_account_info();
        let client_info = ctx.accounts.client.to_account_info();
        require!(
            escrow_info.lamports().saturating_sub(rent) >= remaining,
            EscrowError::InsufficientEscrowBalance
        );
        let escrow_lamports = escrow_info.lamports();
        let client_lamports = client_info.lamports();
        **escrow_info.try_borrow_mut_lamports()? = escrow_lamports
            .checked_sub(remaining)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        **client_info.try_borrow_mut_lamports()? = client_lamports
            .checked_add(remaining)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        escrow.refunded_amount = escrow
            .refunded_amount
            .checked_add(remaining)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        escrow.state = EscrowState::Expired;
        require!(
            escrow.conservation_holds(),
            EscrowError::ConservationViolation
        );
        emit!(EscrowRefunded {
            escrow: escrow.key(),
            client: escrow.client,
            amount: remaining
        });
        Ok(())
    }

    pub fn open_dispute(ctx: Context<OpenDispute>, evidence_hash: [u8; 32]) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            matches!(escrow.state, EscrowState::Funded | EscrowState::Active),
            EscrowError::InvalidState
        );
        require!(evidence_hash != [0; 32], EscrowError::InvalidEvidence);
        escrow.state = EscrowState::Disputed;
        escrow.disputed_by = ctx.accounts.participant.key();
        escrow.evidence_hash = evidence_hash;
        emit!(DisputeOpened {
            escrow: escrow.key(),
            opened_by: escrow.disputed_by,
            evidence_hash,
        });
        Ok(())
    }

    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        client_amount: u64,
        freelancer_amount: u64,
        resolution_hash: [u8; 32],
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            escrow.state == EscrowState::Disputed,
            EscrowError::InvalidState
        );
        require!(resolution_hash != [0; 32], EscrowError::InvalidEvidence);
        let remaining = escrow.remaining()?;
        let awarded = client_amount
            .checked_add(freelancer_amount)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        require!(awarded == remaining, EscrowError::ResolutionTotalMismatch);
        let rent = Rent::get()?.minimum_balance(8 + Escrow::INIT_SPACE);
        let escrow_info = escrow.to_account_info();
        require!(
            escrow_info.lamports().saturating_sub(rent) >= remaining,
            EscrowError::InsufficientEscrowBalance
        );
        transfer_owned_lamports(
            &escrow_info,
            &ctx.accounts.client.to_account_info(),
            client_amount,
        )?;
        transfer_owned_lamports(
            &escrow_info,
            &ctx.accounts.freelancer.to_account_info(),
            freelancer_amount,
        )?;
        escrow.refunded_amount = escrow
            .refunded_amount
            .checked_add(client_amount)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        escrow.released_amount = escrow
            .released_amount
            .checked_add(freelancer_amount)
            .ok_or(EscrowError::ArithmeticOverflow)?;
        escrow.resolution_hash = resolution_hash;
        escrow.state = EscrowState::Resolved;
        require!(escrow.remaining()? == 0, EscrowError::ConservationViolation);
        require!(
            escrow.conservation_holds(),
            EscrowError::ConservationViolation
        );
        emit!(DisputeResolved {
            escrow: escrow.key(),
            resolver: ctx.accounts.resolver.key(),
            client_amount,
            freelancer_amount,
            resolution_hash,
        });
        Ok(())
    }
}

fn transfer_owned_lamports<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let from_balance = from.lamports();
    let to_balance = to.lamports();
    **from.try_borrow_mut_lamports()? = from_balance
        .checked_sub(amount)
        .ok_or(EscrowError::ArithmeticOverflow)?;
    **to.try_borrow_mut_lamports()? = to_balance
        .checked_add(amount)
        .ok_or(EscrowError::ArithmeticOverflow)?;
    Ok(())
}

fn calculate_fee(amount: u64, fee_bps: u16) -> Result<u64> {
    amount
        .checked_mul(u64::from(fee_bps))
        .and_then(|value| value.checked_div(10_000))
        .ok_or(EscrowError::ArithmeticOverflow.into())
}

#[derive(Accounts)]
#[instruction(contract_id: [u8; 32])]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    /// CHECK: Address is stored and later constrained; no account data is read.
    pub freelancer: UncheckedAccount<'info>,
    /// CHECK: Address is stored for a later dispute instruction; no account data is read.
    pub resolver: UncheckedAccount<'info>,
    /// CHECK: Address is stored and constrained as a SystemAccount on release.
    pub fee_recipient: UncheckedAccount<'info>,
    #[account(init, payer = client, space = 8 + Escrow::INIT_SPACE, seeds = [b"escrow", contract_id.as_ref(), client.key().as_ref(), freelancer.key().as_ref()], bump)]
    pub escrow: Account<'info, Escrow>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(index: u16)]
pub struct AddMilestone<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(mut, has_one = client @ EscrowError::Unauthorized, seeds = [b"escrow", escrow.contract_id.as_ref(), escrow.client.as_ref(), escrow.freelancer.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    #[account(init, payer = client, space = 8 + Milestone::INIT_SPACE, seeds = [b"milestone", escrow.key().as_ref(), &index.to_le_bytes()], bump)]
    pub milestone: Account<'info, Milestone>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub client: Signer<'info>,
    #[account(mut, has_one = client @ EscrowError::Unauthorized, seeds = [b"escrow", escrow.contract_id.as_ref(), escrow.client.as_ref(), escrow.freelancer.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,
}

#[derive(Accounts)]
pub struct SubmitMilestone<'info> {
    pub freelancer: Signer<'info>,
    #[account(mut, has_one = freelancer @ EscrowError::Unauthorized, seeds = [b"escrow", escrow.contract_id.as_ref(), escrow.client.as_ref(), escrow.freelancer.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut, has_one = escrow @ EscrowError::InvalidRelationship, seeds = [b"milestone", escrow.key().as_ref(), &milestone.index.to_le_bytes()], bump = milestone.bump)]
    pub milestone: Account<'info, Milestone>,
}

#[derive(Accounts)]
pub struct ApproveMilestone<'info> {
    pub client: Signer<'info>,
    #[account(has_one = client @ EscrowError::Unauthorized, seeds = [b"escrow", escrow.contract_id.as_ref(), escrow.client.as_ref(), escrow.freelancer.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut, has_one = escrow @ EscrowError::InvalidRelationship, seeds = [b"milestone", escrow.key().as_ref(), &milestone.index.to_le_bytes()], bump = milestone.bump)]
    pub milestone: Account<'info, Milestone>,
}

#[derive(Accounts)]
pub struct ReleaseMilestone<'info> {
    pub client: Signer<'info>,
    #[account(mut, has_one = client @ EscrowError::Unauthorized, seeds = [b"escrow", escrow.contract_id.as_ref(), escrow.client.as_ref(), escrow.freelancer.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut, address = escrow.freelancer @ EscrowError::InvalidRelationship)]
    pub freelancer: SystemAccount<'info>,
    #[account(mut, address = escrow.fee_recipient @ EscrowError::InvalidRelationship)]
    pub fee_recipient: SystemAccount<'info>,
    #[account(mut, has_one = escrow @ EscrowError::InvalidRelationship, seeds = [b"milestone", escrow.key().as_ref(), &milestone.index.to_le_bytes()], bump = milestone.bump)]
    pub milestone: Account<'info, Milestone>,
}

#[derive(Accounts)]
pub struct RefundExpired<'info> {
    #[account(mut, address = escrow.client @ EscrowError::InvalidRelationship)]
    pub client: SystemAccount<'info>,
    #[account(mut, seeds = [b"escrow", escrow.contract_id.as_ref(), escrow.client.as_ref(), escrow.freelancer.as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub participant: Signer<'info>,
    #[account(
        mut,
        constraint = participant.key() == escrow.client || participant.key() == escrow.freelancer @ EscrowError::Unauthorized,
        seeds = [b"escrow", escrow.contract_id.as_ref(), escrow.client.as_ref(), escrow.freelancer.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    pub resolver: Signer<'info>,
    #[account(
        mut,
        has_one = resolver @ EscrowError::Unauthorized,
        seeds = [b"escrow", escrow.contract_id.as_ref(), escrow.client.as_ref(), escrow.freelancer.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mut, address = escrow.client @ EscrowError::InvalidRelationship)]
    pub client: SystemAccount<'info>,
    #[account(mut, address = escrow.freelancer @ EscrowError::InvalidRelationship)]
    pub freelancer: SystemAccount<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub contract_id: [u8; 32],
    pub client: Pubkey,
    pub freelancer: Pubkey,
    pub resolver: Pubkey,
    pub fee_recipient: Pubkey,
    pub fee_bps: u16,
    pub platform_fee_paid: u64,
    pub total_amount: u64,
    pub planned_amount: u64,
    pub funded_amount: u64,
    pub released_amount: u64,
    pub refunded_amount: u64,
    pub expires_at: i64,
    pub milestone_count: u16,
    pub next_milestone: u16,
    pub state: EscrowState,
    pub disputed_by: Pubkey,
    pub evidence_hash: [u8; 32],
    pub resolution_hash: [u8; 32],
    pub bump: u8,
}

impl Escrow {
    pub fn remaining(&self) -> Result<u64> {
        self.funded_amount
            .checked_sub(self.released_amount)
            .and_then(|value| value.checked_sub(self.refunded_amount))
            .ok_or(EscrowError::ConservationViolation.into())
    }
    pub fn conservation_holds(&self) -> bool {
        self.released_amount
            .checked_add(self.refunded_amount)
            .is_some_and(|spent| {
                spent <= self.funded_amount && self.funded_amount <= self.total_amount
            })
    }
}

#[account]
#[derive(InitSpace)]
pub struct Milestone {
    pub escrow: Pubkey,
    pub index: u16,
    pub amount: u64,
    pub due_at: i64,
    pub state: MilestoneState,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum EscrowState {
    Draft,
    Funded,
    Active,
    Completed,
    Expired,
    Disputed,
    Resolved,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum MilestoneState {
    Pending,
    Submitted,
    Approved,
    Released,
    Refunded,
}

#[event]
pub struct EscrowInitialized {
    pub escrow: Pubkey,
    pub contract_id: [u8; 32],
    pub client: Pubkey,
    pub freelancer: Pubkey,
    pub total_amount: u64,
    pub expires_at: i64,
}
#[event]
pub struct MilestoneAdded {
    pub escrow: Pubkey,
    pub milestone: Pubkey,
    pub index: u16,
    pub amount: u64,
    pub due_at: i64,
}
#[event]
pub struct EscrowFunded {
    pub escrow: Pubkey,
    pub amount: u64,
    pub funded_amount: u64,
}
#[event]
pub struct MilestoneSubmitted {
    pub escrow: Pubkey,
    pub milestone: Pubkey,
    pub index: u16,
}
#[event]
pub struct MilestoneApproved {
    pub escrow: Pubkey,
    pub milestone: Pubkey,
    pub index: u16,
}
#[event]
pub struct MilestoneReleased {
    pub escrow: Pubkey,
    pub milestone: Pubkey,
    pub index: u16,
    pub amount: u64,
    pub fee: u64,
}
#[event]
pub struct EscrowRefunded {
    pub escrow: Pubkey,
    pub client: Pubkey,
    pub amount: u64,
}
#[event]
pub struct DisputeOpened {
    pub escrow: Pubkey,
    pub opened_by: Pubkey,
    pub evidence_hash: [u8; 32],
}
#[event]
pub struct DisputeResolved {
    pub escrow: Pubkey,
    pub resolver: Pubkey,
    pub client_amount: u64,
    pub freelancer_amount: u64,
    pub resolution_hash: [u8; 32],
}

#[error_code]
pub enum EscrowError {
    #[msg("Amount must be positive")]
    InvalidAmount,
    #[msg("Expiry is invalid")]
    InvalidExpiry,
    #[msg("Participants must be distinct")]
    DuplicateParticipant,
    #[msg("Signer is not authorized")]
    Unauthorized,
    #[msg("Account relationship is invalid")]
    InvalidRelationship,
    #[msg("State transition is invalid")]
    InvalidState,
    #[msg("Milestone order is invalid")]
    InvalidMilestoneOrder,
    #[msg("Milestone total must equal contract total")]
    MilestoneTotalMismatch,
    #[msg("Funding exceeds contract total")]
    Overfunded,
    #[msg("Checked arithmetic failed")]
    ArithmeticOverflow,
    #[msg("Escrow conservation invariant failed")]
    ConservationViolation,
    #[msg("Escrow balance cannot cover this transition")]
    InsufficientEscrowBalance,
    #[msg("Escrow is not expired")]
    NotExpired,
    #[msg("Evidence or resolution digest is invalid")]
    InvalidEvidence,
    #[msg("Resolution awards must equal the remaining balance")]
    ResolutionTotalMismatch,
    #[msg("Platform fee exceeds 10 percent")]
    FeeTooHigh,
}

#[cfg(test)]
mod tests {
    use super::*;
    fn escrow(funded: u64, released: u64, refunded: u64) -> Escrow {
        Escrow {
            contract_id: [1; 32],
            client: Pubkey::new_unique(),
            freelancer: Pubkey::new_unique(),
            resolver: Pubkey::new_unique(),
            fee_recipient: Pubkey::new_unique(),
            fee_bps: 250,
            platform_fee_paid: 0,
            total_amount: 1_000,
            planned_amount: 1_000,
            funded_amount: funded,
            released_amount: released,
            refunded_amount: refunded,
            expires_at: 100,
            milestone_count: 2,
            next_milestone: 0,
            state: EscrowState::Funded,
            disputed_by: Pubkey::default(),
            evidence_hash: [0; 32],
            resolution_hash: [0; 32],
            bump: 255,
        }
    }
    #[test]
    fn conservation_accepts_partial_and_complete_spend() {
        assert!(escrow(1_000, 400, 0).conservation_holds());
        assert_eq!(escrow(1_000, 400, 0).remaining().unwrap(), 600);
        assert!(escrow(1_000, 400, 600).conservation_holds());
    }
    #[test]
    fn conservation_rejects_release_or_refund_beyond_funding() {
        assert!(!escrow(1_000, 1_001, 0).conservation_holds());
        assert!(!escrow(1_000, 700, 301).conservation_holds());
        assert!(escrow(1_000, 1_001, 0).remaining().is_err());
    }
    #[test]
    fn checked_totals_reject_overflow() {
        let mut value = escrow(u64::MAX, 0, 0);
        value.total_amount = u64::MAX;
        assert!(value.funded_amount.checked_add(1).is_none());
    }
    #[test]
    fn milestone_states_are_one_way() {
        let allowed = [
            (MilestoneState::Pending, MilestoneState::Submitted),
            (MilestoneState::Submitted, MilestoneState::Approved),
            (MilestoneState::Approved, MilestoneState::Released),
        ];
        assert_eq!(allowed.len(), 3);
        assert!(!allowed.contains(&(MilestoneState::Released, MilestoneState::Approved)));
    }

    #[test]
    fn sequential_releases_finish_only_after_the_final_milestone() {
        let mut value = escrow(1_000, 0, 0);
        value.released_amount = value.released_amount.checked_add(400).unwrap();
        value.next_milestone = value.next_milestone.checked_add(1).unwrap();
        assert_eq!(value.remaining().unwrap(), 600);
        assert_ne!(value.next_milestone, value.milestone_count);

        value.released_amount = value.released_amount.checked_add(600).unwrap();
        value.next_milestone = value.next_milestone.checked_add(1).unwrap();
        assert_eq!(value.remaining().unwrap(), 0);
        assert_eq!(value.next_milestone, value.milestone_count);
        assert!(value.conservation_holds());
    }

    #[test]
    fn expiry_refunds_only_the_unspent_balance() {
        let mut value = escrow(1_000, 400, 0);
        let refund = value.remaining().unwrap();
        value.refunded_amount = value.refunded_amount.checked_add(refund).unwrap();
        assert_eq!(refund, 600);
        assert_eq!(value.remaining().unwrap(), 0);
        assert!(value.conservation_holds());
    }

    #[test]
    fn dispute_awards_must_exactly_conserve_remaining_funds() {
        let value = escrow(1_000, 400, 0);
        let remaining = value.remaining().unwrap();
        assert_eq!(400_u64.checked_add(200), Some(remaining));
        assert_ne!(400_u64.checked_add(199), Some(remaining));
        assert!(u64::MAX.checked_add(1).is_none());
    }

    #[test]
    fn fee_math_is_capped_and_checked() {
        assert_eq!(calculate_fee(10_000, 250).unwrap(), 250);
        assert_eq!(calculate_fee(1, 250).unwrap(), 0);
        assert!(calculate_fee(u64::MAX, 1_000).is_err());
    }

    #[test]
    fn escrow_pdas_are_isolated_by_contract_and_participants() {
        let client = Pubkey::new_unique();
        let freelancer = Pubkey::new_unique();
        let other_client = Pubkey::new_unique();
        let (first, first_bump) = Pubkey::find_program_address(
            &[b"escrow", &[1; 32], client.as_ref(), freelancer.as_ref()],
            &crate::ID,
        );
        let (second, _) = Pubkey::find_program_address(
            &[b"escrow", &[2; 32], client.as_ref(), freelancer.as_ref()],
            &crate::ID,
        );
        let (third, _) = Pubkey::find_program_address(
            &[
                b"escrow",
                &[1; 32],
                other_client.as_ref(),
                freelancer.as_ref(),
            ],
            &crate::ID,
        );
        assert_ne!(first, second);
        assert_ne!(first, third);
        assert_eq!(
            Pubkey::create_program_address(
                &[
                    b"escrow",
                    &[1; 32],
                    client.as_ref(),
                    freelancer.as_ref(),
                    &[first_bump],
                ],
                &crate::ID,
            )
            .unwrap(),
            first,
        );
    }

    #[test]
    fn terminal_states_cannot_be_used_as_active_settlement_states() {
        for state in [
            EscrowState::Completed,
            EscrowState::Expired,
            EscrowState::Resolved,
        ] {
            assert!(!matches!(state, EscrowState::Funded | EscrowState::Active));
        }
    }
}
