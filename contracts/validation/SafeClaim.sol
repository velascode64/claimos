// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRewardToken {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract SafeClaim {
    IRewardToken public immutable rewardToken;
    mapping(address => bool) public claimed;
    uint256 public constant REWARD = 100e6;

    constructor(address rewardToken_) {
        rewardToken = IRewardToken(rewardToken_);
    }

    function claim() external {
        require(!claimed[msg.sender], "already claimed");
        claimed[msg.sender] = true;
        require(rewardToken.transfer(msg.sender, REWARD), "reward transfer");
    }
}

