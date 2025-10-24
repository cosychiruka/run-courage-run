export const abi = [
    // Contract ABI 
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "collateralToken",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "collateralAmount",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "loanAmount",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "loanToken",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "repaymentAmount",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "loanDuration",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "reservedLender",
          "type": "address"
        }
      ],
      "name": "requestLoan",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "requestId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "loanToken",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "fundLoan",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "requestId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "loanToken",
          "type": "address"
        }
      ],
      "name": "repayLoan",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "loanRequestCounter",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "loanRequests",
      "outputs": [
        {
          "internalType": "address",
          "name": "borrower",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "collateralToken",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "collateralAmount",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "loanAmount",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "loanToken",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "reservedLender",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "repaymentAmount",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "startTime",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "endTime",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "isRepaid",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "isFunded",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        }
      ],
      "name": "getTotalBorrowed",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "totalBorrowedETH",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "totalBorrowedDAI",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        }
      ],
      "name": "getTotalRepaid",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "totalRepaidETH",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "totalRepaidDAI",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "lender",
          "type": "address"
        }
      ],
      "name": "getInterestEarned",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "totalInterestEarnedETH",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "totalInterestEarnedDAI",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];
  
  export const contractAddress = "OUR_CONTRACT_ADDRESS_HERE";
  
  // Exporting the ABI and contract address
  export default { abi, contractAddress };
  