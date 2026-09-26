// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {HeistTrophy} from "../src/HeistTrophy.sol";

/// Deploys the soulbound trophy the agent mints to each successful robber.
/// MINTER_ADDRESS is the Worker's agent key (the same AGENT_ADDRESS as the vault).
/// OWNER_ADDRESS (default: the broadcasting key) can rotate the minter.
///
///   MINTER_ADDRESS=0x... forge script script/DeployTrophy.s.sol \
///     --rpc-url base_sepolia --private-key $DEPLOYER_PRIVATE_KEY --broadcast
contract DeployTrophy is Script {
    function run() external returns (HeistTrophy trophy) {
        address minter = vm.envAddress("MINTER_ADDRESS");
        address owner = vm.envOr("OWNER_ADDRESS", msg.sender);

        vm.startBroadcast();
        trophy = new HeistTrophy(owner, minter);
        vm.stopBroadcast();

        console.log("TROPHY_ADDRESS=%s", address(trophy));
        console.log("owner=%s minter=%s", owner, minter);
    }
}
