import { MAINNET_SOLANA_CONTRACT_ADDRESS, DEVNET_SOLANA_CONTRACT_ADDRESS } from './env';

// Contract data configuration with network-specific settings
export const contractData = {
  'mainnet': {
    address: MAINNET_SOLANA_CONTRACT_ADDRESS,
    note: "Solana Mainnet",
    enabled: true,
    name: 'Courage Lending Protocol'
  },
  'devnet': {
    address: DEVNET_SOLANA_CONTRACT_ADDRESS,
    note: "Solana Devnet",
    enabled: true,
    name: 'Courage Lending Protocol'
  },
  'testnet': {
    address: DEVNET_SOLANA_CONTRACT_ADDRESS, // Use devnet for testnet as fallback
    note: "Solana Testnet",
    enabled: true,
    name: 'Courage Lending Protocol'
  },
  'localnet': {
    address: DEVNET_SOLANA_CONTRACT_ADDRESS, // Use devnet for localnet as fallback
    note: "Solana Localnet",
    enabled: true,
    name: 'Courage Lending Protocol'
  },
};
