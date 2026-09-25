// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {HeistToken} from "../src/HeistToken.sol";

/// Deploys the token and the vault, and moves the whole supply into the vault.
/// AGENT_ADDRESS is the Worker's key. OWNER_ADDRESS (default: the broadcasting key)
/// can pause the vault, rotate the agent and sweep tokens.
///
///   AGENT_ADDRESS=0x... forge script script/Deploy.s.sol \
///     --rpc-url base_sepolia --account deployer --broadcast --verify
contract Deploy is Script {
    function run() external returns (HeistToken token, AgentVault vault) {
        address agent = vm.envAddress("AGENT_ADDRESS");
        address owner = vm.envOr("OWNER_ADDRESS", msg.sender);
        string memory name = vm.envOr("TOKEN_NAME", string("Heist"));
        string memory symbol = vm.envOr("TOKEN_SYMBOL", string("HEIST"));
        uint256 supply = vm.envOr("TOKEN_SUPPLY", uint256(1_000_000 ether));
        uint256 maxPerRelease = vm.envOr("MAX_PER_RELEASE", uint256(1_000 ether));
        uint256 maxPerDay = vm.envOr("MAX_PER_DAY", uint256(10_000 ether));

        vm.startBroadcast();
        token = new HeistToken(name, symbol, supply);
        vault = new AgentVault(token, owner, agent, maxPerRelease, maxPerDay);
        token.transfer(address(vault), supply);
        vm.stopBroadcast();

        console.log("VAULT_ADDRESS=%s", address(vault));
        console.log("TOKEN_ADDRESS=%s", address(token));
        console.log("owner=%s agent=%s", owner, agent);
    }
}
