import { UserState } from '../utils/userState.js';
import { walletService } from '../services/wallet.js';
import { networkState } from '../services/networkState.js';

export function setupWalletsCommand(bot) {
  bot.onText(/\/wallets|👛 Wallets/, async (msg) => {
    const chatId = msg.chat.id;
    await showWalletOptions(bot, chatId);
  });

  // Handle wallet-related callbacks
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;

    try {
      switch (action) {
        case 'create_wallet':
          await showCreateWalletPrompt(bot, chatId);
          break;
        case 'select_wallet':
          await showWalletList(bot, chatId);
          break;
        case 'confirm_create_wallet':
          await createNewWallet(bot, chatId);
          break;
        default:
          if (action.startsWith('wallet_details_')) {
            const address = action.replace('wallet_details_', '');
            await showWalletDetails(bot, chatId, address);
          } else if (action.startsWith('select_wallet_')) {
            const address = action.replace('select_wallet_', '');
            await selectWallet(bot, chatId, address);
          } else if (action.startsWith('view_tokens_')) {
            const address = action.replace('view_tokens_', '');
            await showWalletTokens(bot, chatId, address);
          } else if (action.startsWith('token_options_')) {
            const [walletAddress, tokenAddress] = action.replace('token_options_', '').split('_');
            await showTokenOptions(bot, chatId, walletAddress, tokenAddress);
          } else if (action.startsWith('transfer_token_')) {
            const [walletAddress, tokenAddress] = action.replace('transfer_token_', '').split('_');
            await showTransferForm(bot, chatId, walletAddress, tokenAddress);
          } else if (action.startsWith('receive_token_')) {
            const [walletAddress, tokenAddress] = action.replace('receive_token_', '').split('_');
            await showReceiveInfo(bot, chatId, walletAddress, tokenAddress);
          } else if (action.startsWith('copy_address_')) {
            const address = action.replace('copy_address_', '');
            await handleCopyAddress(bot, chatId, address);
          }
      }
    } catch (error) {
      console.error('Error handling wallet action:', error);
      await handleWalletError(bot, chatId);
    }

    await bot.answerCallbackQuery(callbackQuery.id);
  });

  // Handle transfer amount input
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const state = UserState.getState(chatId);
    const pendingTransfer = UserState.getUserData(chatId)?.pendingTransfer;

    if (state === 'WAITING_TRANSFER_ADDRESS' && msg.text && pendingTransfer) {
      await handleTransferAddress(bot, chatId, msg.text, pendingTransfer);
    }
  });
}

async function showWalletOptions(bot, chatId) {
  const currentNetwork = networkState.getCurrentNetwork(chatId);
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ Create New Wallet', callback_data: 'create_wallet' }],
      [{ text: '📋 Select Wallet', callback_data: 'select_wallet' }],
      [{ text: '🔄 Switch Network', callback_data: 'switch_network' }],
      [{ text: '↩️ Back to Menu', callback_data: 'back_to_menu' }]
    ]
  };

  await bot.sendMessage(
    chatId,
    `*Wallet Management* 👛\n\n` +
    `Current Network: *${networkState.getNetworkDisplay(currentNetwork)}*\n\n` +
    'Create or select wallets:',
    { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    }
  );
}

async function showCreateWalletPrompt(bot, chatId) {
  const currentNetwork = networkState.getCurrentNetwork(chatId);
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '✅ Create Wallet', callback_data: 'confirm_create_wallet' }],
      [{ text: '↩️ Back', callback_data: 'back_to_wallets' }]
    ]
  };

  const message = 
    `*Create New ${networkState.getNetworkDisplay(currentNetwork)} Wallet* 🔐\n\n` +
    `⚠️ *Important Security Information*\n\n` +
    `• Your wallet's private key/seed phrase will be shown ONLY ONCE\n` +
    `• Write it down and store it securely\n` +
    `• Never share it with anyone\n` +
    `• If lost, it CANNOT be recovered\n` +
    `• We don't store or have access to your private keys\n\n` +
    `Click "Create Wallet" to proceed:`;

  await bot.sendMessage(chatId, message, { 
    parse_mode: 'Markdown',
    reply_markup: keyboard 
  });
}

async function createNewWallet(bot, chatId) {
  const currentNetwork = networkState.getCurrentNetwork(chatId);
  const loadingMsg = await bot.sendMessage(chatId, '🔐 Creating your wallet...');

  try {
    const wallet = await walletService.createWallet(chatId, currentNetwork);
    await bot.deleteMessage(chatId, loadingMsg.message_id);

    // Send sensitive info in a separate message
    const sensitiveInfo = 
      `🔐 *Your New Wallet Details*\n\n` +
      `Network: ${networkState.getNetworkDisplay(currentNetwork)}\n` +
      `Address: \`${wallet.address}\`\n\n` +
      `🔑 *SAVE THIS INFORMATION SECURELY*\n` +
      `Recovery Phrase:\n\`${wallet.mnemonic}\`\n\n` +
      `Private Key:\n\`${wallet.privateKey}\`\n\n` +
      `⚠️ This message will be deleted in 60 seconds for security!`;

    const msg = await bot.sendMessage(chatId, sensitiveInfo, {
      parse_mode: 'Markdown'
    });

    // Delete sensitive info after 60 seconds
    setTimeout(async () => {
      try {
        await bot.deleteMessage(chatId, msg.message_id);
        await showWalletOptions(bot, chatId);
      } catch (error) {
        console.error('Error deleting sensitive message:', error);
      }
    }, 60000);

  } catch (error) {
    console.error('Error creating wallet:', error);
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    await handleWalletError(bot, chatId);
  }
}

async function showWalletList(bot, chatId) {
  const wallets = walletService.getWallets(chatId);
  const currentNetwork = networkState.getCurrentNetwork(chatId);
  
  if (wallets.length === 0) {
    const keyboard = {
      inline_keyboard: [
        [{ text: '➕ Create Wallet', callback_data: 'create_wallet' }],
        [{ text: '↩️ Back', callback_data: 'back_to_wallets' }]
      ]
    };

    await bot.sendMessage(
      chatId,
      'No wallets found. Create one first!',
      { reply_markup: keyboard }
    );
    return;
  }

  const networkWallets = wallets.filter(w => w.network === currentNetwork);
  
  if (networkWallets.length === 0) {
    const keyboard = {
      inline_keyboard: [
        [{ text: '➕ Create Wallet', callback_data: 'create_wallet' }],
        [{ text: '🔄 Switch Network', callback_data: 'switch_network' }],
        [{ text: '↩️ Back', callback_data: 'back_to_wallets' }]
      ]
    };

    await bot.sendMessage(
      chatId,
      `No wallets found for ${networkState.getNetworkDisplay(currentNetwork)}. Create one first!`,
      { reply_markup: keyboard }
    );
    return;
  }

  const buttons = networkWallets.map(wallet => ([{
    text: `${truncateAddress(wallet.address)}`,
    callback_data: `wallet_details_${wallet.address}`
  }]));

  buttons.push([{ text: '↩️ Back', callback_data: 'back_to_wallets' }]);

  await bot.sendMessage(
    chatId,
    `*Your ${networkState.getNetworkDisplay(currentNetwork)} Wallets* 👛\n\nSelect a wallet to view details:`,
    { 
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    }
  );
}

async function showWalletDetails(bot, chatId, address) {
  const wallet = walletService.getWallet(chatId, address);
  if (!wallet) {
    await bot.sendMessage(chatId, 'Wallet not found.');
    return;
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '📋 Copy Address', callback_data: `copy_address_${wallet.address}` }],
      [{ text: '💰 View Tokens', callback_data: `view_tokens_${wallet.address}` }],
      [{ text: '✅ Set as Active', callback_data: `select_wallet_${wallet.address}` }],
      [{ text: '↩️ Back to Wallets', callback_data: 'select_wallet' }]
    ]
  };

  await bot.sendMessage(
    chatId,
    `*Wallet Details* 💼\n\n` +
    `Network: ${networkState.getNetworkDisplay(wallet.network)}\n` +
    `Address: \`${wallet.address}\`\n\n` +
    `Created: ${new Date(wallet.createdAt).toLocaleString()}`,
    { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    }
  );
}

async function showWalletTokens(bot, chatId, address) {
  const loadingMsg = await bot.sendMessage(chatId, '💰 Loading tokens...');
  
  try {
    const tokens = await walletService.getWalletTokens(chatId, address);
    await bot.deleteMessage(chatId, loadingMsg.message_id);

    if (!tokens || tokens.length === 0) {
      await bot.sendMessage(
        chatId,
        'No tokens found in this wallet.',
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '↩️ Back to Wallet', callback_data: `wallet_details_${address}` }
            ]]
          }
        }
      );
      return;
    }

    let message = '*Wallet Tokens* 💰\n\n';
    tokens.forEach((token, index) => {
      message += `${index + 1}. *${token.symbol}*\n` +
                `• Balance: ${formatBalance(token.balance, token.decimals)}\n` +
                `• Contract: \`${token.address}\`\n` +
                `• [View Token](${getExplorerUrl(token.address)})\n\n`;
    });

    const keyboard = {
      inline_keyboard: tokens.map((token, index) => ([{
        text: `${token.symbol} Options`,
        callback_data: `token_options_${address}_${token.address}`
      }])).concat([[
        { text: '↩️ Back to Wallet', callback_data: `wallet_details_${address}` }
      ]])
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('Error fetching tokens:', error);
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    await handleWalletError(bot, chatId);
  }
}

async function showTokenOptions(bot, chatId, walletAddress, tokenAddress) {
  const wallet = walletService.getWallet(chatId, walletAddress);
  const token = await walletService.getTokenInfo(chatId, walletAddress, tokenAddress);

  if (!wallet || !token) {
    await bot.sendMessage(chatId, '❌ Token not found.');
    return;
  }

  const message = `*${token.symbol} Token Options*\n\n` +
                 `Balance: ${formatBalance(token.balance, token.decimals)}\n` +
                 `Contract: \`${token.address}\``;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '💸 Transfer', callback_data: `transfer_token_${walletAddress}_${tokenAddress}` },
        { text: '📥 Receive', callback_data: `receive_token_${walletAddress}_${tokenAddress}` }
      ],
      [{ text: '↩️ Back to Tokens', callback_data: `view_tokens_${walletAddress}` }]
    ]
  };

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

async function showTransferForm(bot, chatId, walletAddress, tokenAddress) {
  const token = await walletService.getTokenInfo(chatId, walletAddress, tokenAddress);
  
  if (!token) {
    await bot.sendMessage(chatId, '❌ Token not found.');
    return;
  }

  UserState.setState(chatId, 'WAITING_TRANSFER_ADDRESS');
  UserState.setUserData(chatId, { 
    pendingTransfer: { walletAddress, tokenAddress }
  });

  const message = `*Transfer ${token.symbol}*\n\n` +
                 `Available Balance: ${formatBalance(token.balance, token.decimals)}\n\n` +
                 'Please enter the recipient address:';

  const keyboard = {
    inline_keyboard: [[
      { text: '↩️ Cancel Transfer', callback_data: `token_options_${walletAddress}_${tokenAddress}` }
    ]]
  };

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

async function showReceiveInfo(bot, chatId, walletAddress, tokenAddress) {
  const wallet = walletService.getWallet(chatId, walletAddress);
  const token = await walletService.getTokenInfo(chatId, walletAddress, tokenAddress);

  if (!wallet || !token) {
    await bot.sendMessage(chatId, '❌ Token not found.');
    return;
  }

  const message = `*Receive ${token.symbol}*\n\n` +
                 `Send ${token.symbol} to this address:\n` +
                 `\`${wallet.address}\`\n\n` +
                 `Network: ${networkState.getNetworkDisplay(wallet.network)}\n` +
                 `_⚠️ Make sure to send only on the correct network!_`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '📋 Copy Address', callback_data: `copy_address_${wallet.address}` }],
      [{ text: '↩️ Back to Options', callback_data: `token_options_${walletAddress}_${tokenAddress}` }]
    ]
  };

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

async function handleCopyAddress(bot, chatId, address) {
  await bot.sendMessage(
    chatId,
    '✅ Address copied to clipboard:\n' +
    `\`${address}\``,
    { parse_mode: 'Markdown' }
  );
}

async function handleWalletError(bot, chatId) {
  const keyboard = {
    inline_keyboard: [[
      { text: '🔄 Retry', callback_data: 'back_to_wallets' },
      { text: '↩️ Back to Menu', callback_data: 'back_to_menu' }
    ]]
  };

  await bot.sendMessage(
    chatId,
    '❌ An error occurred. Please try again.',
    { reply_markup: keyboard }
  );
}

function truncateAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(balance, decimals) {
  if (!balance) return '0';
  const value = Number(balance) / Math.pow(10, decimals);
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
}

function getExplorerUrl(address) {
  const network = networkState.getCurrentNetwork();
  const explorerMap = {
    ethereum: `https://etherscan.io/token/${address}`,
    base: `https://basescan.org/token/${address}`,
    solana: `https://solscan.io/token/${address}`
  };
  return explorerMap[network] || '#';
}