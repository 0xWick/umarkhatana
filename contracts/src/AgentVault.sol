// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title AgentVault
/// @notice A token treasury controlled by a single AI agent key.
/// @dev The agent's judgement is the only thing deciding *who* gets paid. This
///      contract decides *how much* can leave: a per-release cap and a daily cap,
///      so one successful jailbreak costs a bounded amount and the game goes on.
contract AgentVault is Ownable2Step {
    using SafeERC20 for IERC20;

    /// @notice Everything the agent needs to reason about its own limits, in one call.
    struct Status {
        address token;
        address agent;
        bool paused;
        uint256 balance;
        uint256 maxPerRelease;
        uint256 maxPerDay;
        uint256 releasedToday;
        uint256 remainingToday;
        uint256 releaseCount;
    }

    IERC20 public immutable token;

    address public agent;
    bool public paused;
    uint256 public maxPerRelease;
    uint256 public maxPerDay;
    uint256 public releaseCount;

    uint256 private _day; // UTC day index that `_releasedInDay` belongs to
    uint256 private _releasedInDay;

    event Released(uint256 indexed id, address indexed to, uint256 amount, bytes32 intentHash);
    event AgentChanged(address indexed previous, address indexed current);
    event LimitsChanged(uint256 maxPerRelease, uint256 maxPerDay);
    event PausedChanged(bool paused);
    event Swept(address indexed to, uint256 amount);

    error NotAgent();
    error VaultPaused();
    error InvalidRecipient(address to);
    error ZeroAmount();
    error ExceedsReleaseLimit(uint256 amount, uint256 limit);
    error ExceedsDailyLimit(uint256 amount, uint256 remaining);
    error InsufficientBalance(uint256 amount, uint256 balance);

    constructor(IERC20 token_, address owner_, address agent_, uint256 maxPerRelease_, uint256 maxPerDay_)
        Ownable(owner_)
    {
        token = token_;
        _setAgent(agent_);
        _setLimits(maxPerRelease_, maxPerDay_);
    }

    // ─── Agent ───────────────────────────────────────────────────────────────

    /// @notice Send tokens out of the vault. Only the agent key can call this.
    /// @param intentHash keccak256 of the request that convinced the agent, so every
    ///        release can be traced to the message behind it without putting text on-chain.
    function release(address to, uint256 amount, bytes32 intentHash) external returns (uint256 id) {
        if (msg.sender != agent) revert NotAgent();
        if (paused) revert VaultPaused();
        if (to == address(0) || to == address(this) || to == address(token)) revert InvalidRecipient(to);
        if (amount == 0) revert ZeroAmount();
        if (amount > maxPerRelease) revert ExceedsReleaseLimit(amount, maxPerRelease);
        uint256 remaining = remainingToday();
        if (amount > remaining) revert ExceedsDailyLimit(amount, remaining);
        uint256 balance = token.balanceOf(address(this));
        if (amount > balance) revert InsufficientBalance(amount, balance);

        uint256 today = block.timestamp / 1 days;
        if (today != _day) {
            _day = today;
            _releasedInDay = 0;
        }
        _releasedInDay += amount;
        id = ++releaseCount;

        emit Released(id, to, amount, intentHash);
        token.safeTransfer(to, amount);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function releasedToday() public view returns (uint256) {
        return _day == block.timestamp / 1 days ? _releasedInDay : 0;
    }

    function remainingToday() public view returns (uint256) {
        uint256 released = releasedToday();
        return released >= maxPerDay ? 0 : maxPerDay - released;
    }

    function status() external view returns (Status memory) {
        return Status({
            token: address(token),
            agent: agent,
            paused: paused,
            balance: token.balanceOf(address(this)),
            maxPerRelease: maxPerRelease,
            maxPerDay: maxPerDay,
            releasedToday: releasedToday(),
            remainingToday: remainingToday(),
            releaseCount: releaseCount
        });
    }

    // ─── Owner ───────────────────────────────────────────────────────────────

    /// @notice Rotate the agent key, e.g. if the Worker secret leaks.
    function setAgent(address agent_) external onlyOwner {
        _setAgent(agent_);
    }

    function setLimits(uint256 maxPerRelease_, uint256 maxPerDay_) external onlyOwner {
        _setLimits(maxPerRelease_, maxPerDay_);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedChanged(paused_);
    }

    /// @notice Pull tokens back out, e.g. to end a round or retire the vault.
    function sweep(address to, uint256 amount) external onlyOwner {
        emit Swept(to, amount);
        token.safeTransfer(to, amount);
    }

    function _setAgent(address agent_) private {
        emit AgentChanged(agent, agent_);
        agent = agent_;
    }

    function _setLimits(uint256 maxPerRelease_, uint256 maxPerDay_) private {
        maxPerRelease = maxPerRelease_;
        maxPerDay = maxPerDay_;
        emit LimitsChanged(maxPerRelease_, maxPerDay_);
    }
}
