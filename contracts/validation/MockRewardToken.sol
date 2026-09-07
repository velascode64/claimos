// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockRewardToken {
    string public name = "ClaimOS Test Reward";
    string public symbol = "TEST_REWARD";
    uint8 public immutable decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

