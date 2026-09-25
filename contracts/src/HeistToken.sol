// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title HeistToken
/// @notice A worthless testnet token that exists to be stolen from the AgentVault.
///         Fixed supply, minted once to the deployer, who moves it into the vault.
contract HeistToken is ERC20 {
    constructor(string memory name_, string memory symbol_, uint256 supply) ERC20(name_, symbol_) {
        _mint(msg.sender, supply);
    }
}
