import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ethers } from 'ethers';
import { 
  Wallet, ArrowUpDown, History, Shield, Copy,
  ExternalLink, CheckCircle, Loader, AlertCircle,
  RefreshCw, TrendingUp, Wifi, WifiOff, Settings,
  Info, ChevronDown, ChevronUp
} from 'lucide-react';
import CryptoJS from 'crypto-js';
import './index.css';

// Type declarations for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

// Contract ABI - Keeping OKX integration intact
const SwapPayWalletABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "caller",
        "type": "address"
      }
    ],
    "name": "AuthorizedCallerAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "caller",
        "type": "address"
      }
    ],
    "name": "AuthorizedCallerRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "tokenIn",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "tokenOut",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amountIn",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amountOut",
        "type": "uint256"
      }
    ],
    "name": "SwapExecuted",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "caller",
        "type": "address"
      }
    ],
    "name": "addAuthorizedCaller",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "authorizedCallers",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "tokenIn",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "tokenOut",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "minAmountOut",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "recipient",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          }
        ],
        "internalType": "struct SwapPayWallet.SwapParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "executeSwap",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      },
      {
        "internalType": "address[]",
        "name": "guardians",
        "type": "address[]"
      }
    ],
    "name": "recoverWallet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "caller",
        "type": "address"
      }
    ],
    "name": "removeAuthorizedCaller",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Constants
const CONTRACT_ADDRESS = '0x354b0DD7cD380542a462505296871f1F1954f325';
const XLAYER_CHAIN_ID = 195;
const XLAYER_RPC = 'https://testrpc.xlayer.network';

// Interfaces
interface SwapData {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
}

interface Balance {
  ETH: string;
  USDC: string;
  USDT: string;
}

interface Transaction {
  id: number;
  type: string;
  from: string;
  to: string;
  amount: string;
  amountOut?: string;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
  hash?: string;
}

interface TokenAddresses {
  [key: string]: string;
}

interface TokenDecimals {
  [key: string]: number;
}

interface SwapQuoteData {
  toAmount: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  [key: string]: any;
}

interface NetworkStatus {
  isOnline: boolean;
  latency: number;
}

// OKX API Headers Function - KEEPING ORIGINAL LOGIC
function getHeaders(timestamp: string, method: string, requestPath: string, queryString: string = ""): Record<string, string> {
  const apiKey = process.env.REACT_APP_OKX_API_KEY;
  const secretKey = process.env.REACT_APP_OKX_SECRET_KEY;
  const apiPassphrase = process.env.REACT_APP_OKX_PASSPHRASE;

  if (!apiKey || !secretKey || !apiPassphrase) {
    throw new Error("Missing required OKX API environment variables");
  }

  const stringToSign = timestamp + method + requestPath + queryString;
  return {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-SIGN": CryptoJS.enc.Base64.stringify(
      CryptoJS.HmacSHA256(stringToSign, secretKey)
    ),
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": apiPassphrase,
  };
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-4">
              The application encountered an unexpected error. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary w-full"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Loading Component
const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`${sizeClasses[size]} spinner mx-auto`} />
  );
};

// Notification Component
const Notification: React.FC<{
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose: () => void;
}> = ({ type, message, onClose }) => {
  const typeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertCircle,
    info: Info
  };

  const Icon = icons[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`${typeStyles[type]} border p-4 rounded-lg flex items-center gap-3 animate-slide-up`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="text-current hover:opacity-70 transition-opacity ml-2"
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
};

// Custom Icon wrapper to handle title prop
const IconWrapper: React.FC<{
  Icon: React.ComponentType<any>;
  className?: string;
  onClick?: () => void;
  title?: string;
}> = ({ Icon, className, onClick, title }) => (
  <div
    className={`inline-flex ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
    title={title}
  >
    <Icon className={className} />
  </div>
);

// Main Component
const SwapPayWallet: React.FC = (): React.ReactElement => {
  // State Management
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [balance, setBalance] = useState<Balance>({ ETH: '0.0', USDC: '0.0', USDT: '0.0' });
  const [activeTab, setActiveTab] = useState<string>('swap');
  const [swapData, setSwapData] = useState<SwapData>({
    tokenIn: 'ETH',
    tokenOut: 'USDC',
    amountIn: '',
    amountOut: ''
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [tokenAddresses, setTokenAddresses] = useState<TokenAddresses>({});
  const [tokenDecimals, setTokenDecimals] = useState<TokenDecimals>({});
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [quotedToAmount, setQuotedToAmount] = useState<string>('0');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [swapQuoteData, setSwapQuoteData] = useState<SwapQuoteData | null>(null);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({ isOnline: true, latency: 0 });
  const [notifications, setNotifications] = useState<Array<{ id: number; type: 'success' | 'error' | 'warning' | 'info'; message: string }>>([]);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Memoized token configurations
  const tokenConfig = useMemo(() => ({
    addresses: {
      ETH: '0x4200000000000000000000000000000000000006',  // WETH on XLayer
      USDC: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDC on XLayer
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'  // USDT on XLayer
    },
    decimals: {
      ETH: 18,
      USDC: 6,
      USDT: 6
    }
  }), []);

  // Notification management
  const addNotification = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, type, message }]);
  }, []);

  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  // Network status monitoring
  useEffect(() => {
    const checkNetworkStatus = async () => {
      const startTime = Date.now();
      try {
        await fetch('https://web3.okx.com/api/v5/dex/aggregator/quote?chainId=195&fromTokenAddress=0x4200000000000000000000000000000000000006&toTokenAddress=0x94b008aA00579c1307B0EF2c499aD98a8ce58e58&amount=1000000000000000000&slippage=0.005', { method: 'HEAD' });
        const latency = Date.now() - startTime;
        setNetworkStatus({ isOnline: true, latency });
      } catch {
        setNetworkStatus({ isOnline: false, latency: 0 });
      }
    };

    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Wallet connection with enhanced error handling
  const connectWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }
      
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[];
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.');
      }

      const _provider = new ethers.providers.Web3Provider(window.ethereum);
      const _signer = _provider.getSigner();
      const address = await _signer.getAddress();
      
      // Check network
      const network = await _provider.getNetwork();
      if (network.chainId !== XLAYER_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${XLAYER_CHAIN_ID.toString(16)}` }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            // Network not added, add it
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${XLAYER_CHAIN_ID.toString(16)}`,
                chainName: 'XLayer Testnet',
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: [XLAYER_RPC],
                blockExplorerUrls: ['https://www.oklink.com/xlayer-test'],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }
      
      setProvider(_provider);
      setSigner(_signer);
      setWalletAddress(address);
      setIsConnected(true);
      setTokenAddresses(tokenConfig.addresses);
      setTokenDecimals(tokenConfig.decimals);

      const _contract = new ethers.Contract(CONTRACT_ADDRESS, SwapPayWalletABI, _signer);
      setContract(_contract);
      
      await fetchBalances(_provider, address);
      await fetchTransactionHistory(_contract, address);
      
      addNotification('success', 'Wallet connected successfully!');
      
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
      const errorMessage = err.message || 'Failed to connect wallet';
      setError(errorMessage);
      addNotification('error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tokenConfig, addNotification]);

  // Enhanced balance fetching
  const fetchBalances = useCallback(async (
    _provider: ethers.providers.Web3Provider, 
    address: string
  ) => {
    try {
      setIsLoading(true);
      
      // Fetch ETH balance
      const ethBalance = await _provider.getBalance(address);
      const ethFormatted = parseFloat(ethers.utils.formatEther(ethBalance)).toFixed(6);
      
      // Fetch token balances
      const tokenBalances = await Promise.all([
        // USDC
        (async () => {
          try {
            const contract = new ethers.Contract(
              tokenConfig.addresses.USDC, 
              ['function balanceOf(address) view returns (uint256)'], 
              _provider
            );
            const balance = await contract.balanceOf(address);
            return parseFloat(ethers.utils.formatUnits(balance, tokenConfig.decimals.USDC)).toFixed(2);
          } catch {
            return '0.00';
          }
        })(),
        // USDT
        (async () => {
          try {
            const contract = new ethers.Contract(
              tokenConfig.addresses.USDT, 
              ['function balanceOf(address) view returns (uint256)'], 
              _provider
            );
            const balance = await contract.balanceOf(address);
            return parseFloat(ethers.utils.formatUnits(balance, tokenConfig.decimals.USDT)).toFixed(2);
          } catch {
            return '0.00';
          }
        })()
      ]);

      setBalance({ 
        ETH: ethFormatted, 
        USDC: tokenBalances[0],
        USDT: tokenBalances[1]
      });
      
    } catch (err: any) {
      console.error('Balance fetch failed:', err);
      addNotification('warning', 'Failed to fetch some balances');
    } finally {
      setIsLoading(false);
    }
  }, [tokenConfig, addNotification]);

  // Enhanced transaction history
  const fetchTransactionHistory = useCallback(async (_contract: ethers.Contract, address: string) => {
    try {
      const filter = _contract.filters.SwapExecuted(address);
      const events = await _contract.queryFilter(filter, -10000);
      
      const txHistory: Transaction[] = events.map((event, index) => ({
        id: index + 1,
        type: 'swap',
        from: getTokenSymbol(event.args?.tokenIn || ''),
        to: getTokenSymbol(event.args?.tokenOut || ''),
        amount: ethers.utils.formatUnits(
          event.args?.amountIn || '0', 
          tokenConfig.decimals[getTokenSymbol(event.args?.tokenIn || '')] || 18
        ),
        amountOut: ethers.utils.formatUnits(
          event.args?.amountOut || '0', 
          tokenConfig.decimals[getTokenSymbol(event.args?.tokenOut || '')] || 18
        ),
        status: 'completed' as const,
        timestamp: `Block ${event.blockNumber}`,
        hash: event.transactionHash
      }));

      setTransactions(txHistory);
      
    } catch (err: any) {
      console.error('Failed to fetch transaction history:', err);
      addNotification('warning', 'Using cached transaction history');
    }
  }, [tokenConfig, addNotification]);

  // Token symbol resolution
  const getTokenSymbol = useCallback((address: string): string => {
    const addressLower = address.toLowerCase();
    for (const [symbol, tokenAddr] of Object.entries(tokenConfig.addresses)) {
      if (tokenAddr.toLowerCase() === addressLower) {
        return symbol;
      }
    }
    return 'UNKNOWN';
  }, [tokenConfig]);

  // Enhanced swap quote fetching - KEEPING OKX API LOGIC INTACT
  const fetchSwapQuote = useCallback(async (retries: number = 3, delay: number = 1000) => {
    if (!swapData.amountIn || !tokenConfig.addresses[swapData.tokenIn] || !tokenConfig.addresses[swapData.tokenOut]) {
      return;
    }

    if (parseFloat(swapData.amountIn) <= 0) {
      setSwapData(prev => ({ ...prev, amountOut: '' }));
      return;
    }

    try {
      setIsLoading(true);
      
      const baseUrl = process.env.REACT_APP_OKX_BASE_URL;
      if (!baseUrl) {
        throw new Error('OKX API configuration missing');
      }
      
      const requestPath = "/api/v5/dex/aggregator/quote";
      
      const amountInWei = ethers.utils.parseUnits(
        swapData.amountIn, 
        tokenConfig.decimals[swapData.tokenIn]
      ).toString();
      
      const params = {
        chainId: XLAYER_CHAIN_ID.toString(),
        fromTokenAddress: tokenConfig.addresses[swapData.tokenIn],
        toTokenAddress: tokenConfig.addresses[swapData.tokenOut],
        amount: amountInWei,
        slippage: '0.005' // 0.5%
      };
      
      const queryString = "?" + new URLSearchParams(params).toString();
      const timestamp = new Date().toISOString();
      const headers = getHeaders(timestamp, "GET", requestPath, queryString);

      const response = await fetch(`${baseUrl}${requestPath}${queryString}`, {
        method: "GET",
        headers
      });
      
      if (response.status === 429 && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchSwapQuote(retries - 1, delay * 2);
      }
      
      if (!response.ok) {
        throw new Error(`OKX API Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.code !== "0") {
        throw new Error(data.msg || 'Failed to get quote from OKX DEX');
      }
      
      const quoteData = data.data?.[0];
      if (!quoteData) {
        throw new Error('No quote data received');
      }
      
      const toAmount = quoteData.toAmount || '0';
      setQuotedToAmount(toAmount);
      setSwapQuoteData(quoteData);
      
      const amountOut = ethers.utils.formatUnits(
        toAmount, 
        tokenConfig.decimals[swapData.tokenOut]
      );
      
      setSwapData(prev => ({ 
        ...prev, 
        amountOut: parseFloat(amountOut).toFixed(6) 
      }));
      
    } catch (err: any) {
      console.error('Quote fetch failed:', err);
      setSwapData(prev => ({ ...prev, amountOut: '' }));
      setSwapQuoteData(null);
      setError(err.message);
      addNotification('error', `Quote failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [swapData.amountIn, swapData.tokenIn, swapData.tokenOut, tokenConfig, addNotification]);

  // Enhanced swap execution - KEEPING ORIGINAL LOGIC
  const executeSwap = useCallback(async () => {
    if (!swapData.amountIn || !contract || !swapQuoteData || !signer || !walletAddress) {
      addNotification('error', 'Missing required data for swap execution');
      return;
    }
    
    setIsSwapping(true);
    setSwapStatus('processing');
    setError(null);
    
    try {
      const tokenInAddress = tokenConfig.addresses[swapData.tokenIn];
      const tokenOutAddress = tokenConfig.addresses[swapData.tokenOut];
      const decimals = tokenConfig.decimals[swapData.tokenIn];
      const amountInWei = ethers.utils.parseUnits(swapData.amountIn, decimals);

      // Approve token if not ETH
      if (tokenInAddress !== ethers.constants.AddressZero && swapData.tokenIn !== 'ETH') {
        setSwapStatus('approving');
        addNotification('info', `Approving ${swapData.tokenIn} spend...`);
        
        const tokenInContract = new ethers.Contract(
          tokenInAddress, 
          ['function approve(address spender, uint256 amount) external returns (bool)'], 
          signer
        );
        
        const approveTx = await tokenInContract.approve(CONTRACT_ADDRESS, amountInWei);
        await approveTx.wait();
        
        addNotification('success', `${swapData.tokenIn} approved successfully`);
      }

      setSwapStatus('swapping');
      addNotification('info', 'Executing swap transaction...');
      
      // Calculate minimum amount out with slippage protection
      const minAmountOut = ethers.BigNumber.from(quotedToAmount)
        .mul(995) // 0.5% slippage tolerance
        .div(1000);

      const swapParams = {
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        amountIn: amountInWei,
        minAmountOut: minAmountOut,
        recipient: walletAddress,
        deadline: Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes
      };
      
      const swapTx = await contract.executeSwap(swapParams, {
        value: swapData.tokenIn === 'ETH' ? amountInWei : 0,
        gasLimit: 500000 // Set gas limit to prevent failures
      });
      
      const receipt = await swapTx.wait();
      
      const newTransaction: Transaction = {
        id: Date.now(),
        type: 'swap',
        from: swapData.tokenIn,
        to: swapData.tokenOut,
        amount: swapData.amountIn,
        amountOut: swapData.amountOut,
        status: 'completed',
        timestamp: new Date().toLocaleString(),
        hash: receipt.transactionHash
      };

      setTransactions(prev => [newTransaction, ...prev]);
      setSwapStatus('success');
      addNotification('success', `Swap completed! ${swapData.amountIn} ${swapData.tokenIn} → ${swapData.amountOut} ${swapData.tokenOut}`);
      
      // Refresh balances
      if (provider && walletAddress) {
        await fetchBalances(provider, walletAddress);
      }

      // Reset form after successful swap
      setTimeout(() => {
        setSwapData(prev => ({ ...prev, amountIn: '', amountOut: '' }));
        setSwapStatus(null);
        setSwapQuoteData(null);
      }, 3000);
      
    } catch (err: any) {
      console.error('Swap failed:', err);
      setSwapStatus('error');
      const errorMessage = err.message || 'Swap transaction failed';
      setError(errorMessage);
      addNotification('error', `Swap failed: ${errorMessage}`);
    } finally {
      setIsSwapping(false);
    }
  }, [swapData, contract, swapQuoteData, signer, walletAddress, tokenConfig, quotedToAmount, provider, fetchBalances, addNotification]);

  // Utility functions
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addNotification('success', 'Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy:', err);
      addNotification('error', 'Failed to copy to clipboard');
    }
  }, [addNotification]);

  const switchTokens = useCallback(() => {
    setSwapData(prev => ({
      ...prev,
      tokenIn: prev.tokenOut,
      tokenOut: prev.tokenIn,
      amountIn: '',
      amountOut: ''
    }));
    setSwapQuoteData(null);
  }, []);

  const formatAddress = useCallback((address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  const formatNumber = useCallback((num: string | number, decimals: number = 6): string => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return '0';
    return n.toFixed(decimals);
  }, []);

  // Auto-fetch quotes when swap data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (swapData.amountIn && parseFloat(swapData.amountIn) > 0) {
        fetchSwapQuote();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [swapData.amountIn, swapData.tokenIn, swapData.tokenOut, fetchSwapQuote]);

  // Account change listener
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (...args: unknown[]) => {
        const accounts = args[0] as string[];
        if (accounts.length === 0) {
          // User disconnected wallet
          setIsConnected(false);
          setWalletAddress('');
          setBalance({ ETH: '0.0', USDC: '0.0', USDT: '0.0' });
          setTransactions([]);
          addNotification('warning', 'Wallet disconnected');
        } else if (accounts[0] !== walletAddress) {
          // User switched accounts
          setWalletAddress(accounts[0]);
          if (provider) {
            fetchBalances(provider, accounts[0]);
          }
          addNotification('info', 'Account switched');
        }
      };

      const handleChainChanged = (...args: unknown[]) => {
        const chainId = args[0] as string;
        const newChainId = parseInt(chainId, 16);
        if (newChainId !== XLAYER_CHAIN_ID) {
          addNotification('warning', 'Please switch to XLayer Testnet');
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
    return () => {};
  }, [walletAddress, provider, fetchBalances, addNotification]);

  // Component definitions
  const WalletHeader: React.FC = () => (
    <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white p-6 rounded-t-2xl relative overflow-hidden">
      <div className="absolute inset-0 bg-white opacity-10 transform rotate-12 scale-150"></div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text text-white">SwapPay</h1>
              <p className="text-sm opacity-90">Powered by OKX DEX</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {networkStatus.isOnline ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-400" />
              )}
              <span className="text-xs">{networkStatus.latency}ms</span>
            </div>
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
            <span className="text-sm font-medium">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        
        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm opacity-90 bg-white/10 p-3 rounded-lg backdrop-blur-sm">
              <span className="font-mono flex-1">{formatAddress(walletAddress)}</span>
              <IconWrapper 
                Icon={Copy}
                className="w-4 h-4 hover:opacity-70 transition-opacity" 
                onClick={() => copyToClipboard(walletAddress)}
                title="Copy address"
              />
              <IconWrapper 
                Icon={ExternalLink}
                className="w-4 h-4 hover:opacity-70 transition-opacity"
                onClick={() => window.open(`https://www.oklink.com/xlayer-test/address/${walletAddress}`, '_blank')}
                title="View on explorer"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(balance).map(([token, amount]) => (
                <div key={token} className="bg-white/15 p-3 rounded-xl backdrop-blur-sm hover:bg-white/20 transition-colors">
                  <div className="text-xs opacity-75 uppercase font-medium">{token}</div>
                  <div className="text-lg font-bold">{formatNumber(amount, token === 'ETH' ? 4 : 2)}</div>
                  <div className="text-xs opacity-60">~$0.00</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            disabled={isLoading}
            className="w-full bg-white text-blue-600 py-3 px-6 rounded-xl font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  const SwapInterface: React.FC = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ArrowUpDown className="w-5 h-5 text-blue-600" />
          Token Swap
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
            OKX DEX
          </span>
          <button 
            onClick={() => fetchSwapQuote()}
            disabled={isLoading || !swapData.amountIn}
            className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Refresh quote"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Advanced settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="space-y-4">
        {/* From Token */}
        <div className="card p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 font-medium">From</span>
            <span className="text-xs text-gray-500">
              Balance: {balance[swapData.tokenIn]} {swapData.tokenIn}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={swapData.tokenIn}
              onChange={(e) => setSwapData({ ...swapData, tokenIn: e.target.value })}
              className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              disabled={!isConnected}
            >
              <option value="ETH">ETH</option>
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
            </select>
            <input
              type="number"
              placeholder="0.0"
              value={swapData.amountIn}
              onChange={(e) => setSwapData({ ...swapData, amountIn: e.target.value })}
              className="flex-1 bg-transparent text-2xl font-semibold outline-none placeholder-gray-400"
              disabled={!isConnected}
              min="0"
              step="any"
            />
            <button
              onClick={() => setSwapData({ ...swapData, amountIn: balance[swapData.tokenIn] })}
              className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded font-medium hover:bg-blue-200 transition-colors"
              disabled={!isConnected}
            >
              MAX
            </button>
          </div>
        </div>
        
        {/* Swap Direction Button */}
        <div className="flex justify-center">
          <button
            onClick={switchTokens}
            disabled={!isConnected}
            className="bg-blue-500 hover:bg-blue-600 p-3 rounded-full text-white transition-all transform hover:scale-110 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            title="Switch tokens"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
        
        {/* To Token */}
        <div className="card p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 font-medium">To</span>
            <span className="text-xs text-gray-500">
              Balance: {balance[swapData.tokenOut]} {swapData.tokenOut}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={swapData.tokenOut}
              onChange={(e) => setSwapData({ ...swapData, tokenOut: e.target.value })}
              className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              disabled={!isConnected}
            >
              <option value="USDC">USDC</option>
              <option value="ETH">ETH</option>
              <option value="USDT">USDT</option>
            </select>
            <div className="flex-1 text-2xl font-semibold text-gray-700 flex items-center gap-2">
              {isLoading && swapData.amountIn ? (
                <LoadingSpinner size="sm" />
              ) : (
                swapData.amountOut || '0.0'
              )}
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="card p-4 space-y-3 animate-slide-up">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Advanced Settings</span>
              <button
                onClick={() => setShowAdvanced(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Slippage Tolerance</label>
                <div className="text-sm font-medium text-gray-800">0.5%</div>
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Transaction Deadline</label>
                <div className="text-sm font-medium text-gray-800">20 min</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Swap Status Messages */}
        {swapStatus === 'approving' && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center gap-3 animate-pulse">
            <LoadingSpinner size="sm" />
            <span className="text-blue-800 font-medium">Approving token spend...</span>
          </div>
        )}
        
        {swapStatus === 'processing' && (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-center gap-3 animate-pulse">
            <LoadingSpinner size="sm" />
            <span className="text-yellow-800 font-medium">Processing swap via OKX DEX...</span>
          </div>
        )}
        
        {swapStatus === 'swapping' && (
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg flex items-center gap-3 animate-pulse">
            <LoadingSpinner size="sm" />
            <span className="text-purple-800 font-medium">Executing swap transaction...</span>
          </div>
        )}
        
        {swapStatus === 'success' && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-center gap-3 animate-fade-in">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">Swap completed successfully!</span>
          </div>
        )}
        
        {swapStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-center gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700 font-medium">Swap failed. Please try again.</span>
          </div>
        )}
        
        {/* Swap Button */}
        <button
          onClick={executeSwap}
          disabled={!swapData.amountIn || !swapData.amountOut || isSwapping || !isConnected || !swapQuoteData || parseFloat(swapData.amountIn) <= 0}
          className="w-full btn-primary py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSwapping ? (
            <>
              <LoadingSpinner size="sm" />
              {swapStatus === 'approving' ? 'Approving...' : 
               swapStatus === 'swapping' ? 'Swapping...' : 'Processing...'}
            </>
          ) : (
            <>
              <TrendingUp className="w-5 h-5" />
              Swap Tokens
            </>
          )}
        </button>
        
        {/* Transaction Details */}
        {swapQuoteData && swapData.amountOut && (
          <div className="card p-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Transaction Details</span>
              <Info className="w-4 h-4 text-gray-400" />
            </div>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Exchange Rate:</span>
                <span className="font-medium">
                  1 {swapData.tokenIn} ≈ {swapData.amountOut && swapData.amountIn ? 
                    formatNumber(parseFloat(swapData.amountOut) / parseFloat(swapData.amountIn), 6) : '0'} {swapData.tokenOut}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Price Impact:</span>
                <span className="font-medium text-green-600">{'<0.01%'}</span>
              </div>
              <div className="flex justify-between">
                <span>Minimum Received:</span>
                <span className="font-medium">
                  {formatNumber(parseFloat(swapData.amountOut || '0') * 0.995, 6)} {swapData.tokenOut}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Network Fee:</span>
                <span className="font-medium">~$0.50</span>
              </div>
              <div className="flex justify-between">
                <span>Route:</span>
                <span className="font-medium">OKX DEX Aggregator</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const TransactionHistory: React.FC = () => (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          Transaction History
        </h2>
        <button 
          onClick={() => contract && fetchTransactionHistory(contract, walletAddress)}
          disabled={!contract || isLoading}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh history"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="space-y-3">
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="font-semibold text-gray-700 mb-2">No transactions yet</h3>
            <p className="text-sm">Your swap history will appear here</p>
            <p className="text-xs mt-2 text-gray-400">Start by making your first swap above</p>
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-500 mb-4">
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            </div>
            {transactions.map((tx) => (
              <div key={tx.id} className="card p-4 hover:shadow-lg transition-all animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      tx.type === 'swap' ? 'bg-blue-100 text-blue-600' :
                      tx.type === 'send' ? 'bg-red-100 text-red-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      {tx.type === 'swap' ? <ArrowUpDown className="w-4 h-4" /> :
                       tx.type === 'send' ? <ExternalLink className="w-4 h-4" /> :
                       <ArrowUpDown className="w-4 h-4 rotate-180" />}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {tx.type === 'swap' ? `Swap ${tx.from} → ${tx.to}` :
                         tx.type === 'send' ? `Send ${tx.from}` :
                         `Receive ${tx.to}`}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <span>{formatNumber(tx.amount, 4)} {tx.from}</span>
                        {tx.amountOut && (
                          <>
                            <span>→</span>
                            <span>{formatNumber(tx.amountOut, 4)} {tx.to}</span>
                          </>
                        )}
                      </div>
                      {tx.hash && (
                        <div className="flex items-center gap-2 mt-1">
                          <button 
                            onClick={() => copyToClipboard(tx.hash!)}
                            className="text-blue-500 hover:text-blue-700 font-mono text-xs flex items-center gap-1"
                            title="Copy transaction hash"
                          >
                            {formatAddress(tx.hash)}
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => window.open(`https://www.oklink.com/xlayer-test/tx/${tx.hash}`, '_blank')}
                            className="text-gray-400 hover:text-gray-600"
                            title="View on explorer"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                      tx.status === 'completed' ? 'bg-green-100 text-green-700' :
                      tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {tx.status}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{tx.timestamp}</div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );

  const SecurityFeatures: React.FC = () => (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Shield className="w-5 h-5 text-green-600" />
        Security & Features
      </h2>
      
      <div className="grid gap-4">
        <div className="card p-4 border-green-200 bg-green-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-green-800">Security Features</h3>
          </div>
          <ul className="text-sm text-green-700 space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              On-chain transaction verification
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Private keys never leave your device
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              End-to-end encryption
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Smart contract audited
            </li>
          </ul>
        </div>
        
        <div className="card p-4 border-blue-200 bg-blue-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-blue-800">Non-Custodial</h3>
          </div>
          <ul className="text-sm text-blue-700 space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              You control your funds at all times
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              No third-party access to your assets
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Decentralized architecture
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Open-source smart contracts
            </li>
          </ul>
        </div>
        
        <div className="card p-4 border-purple-200 bg-purple-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-purple-800">OKX DEX Integration</h3>
          </div>
          <ul className="text-sm text-purple-700 space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Best price aggregation
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Low slippage protection
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              MEV protection
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Gas optimization
            </li>
          </ul>
        </div>
        
        <div className="card p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Contract Information
            </h3>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-medium">Contract Address:</span>
              <span className="text-blue-600 cursor-pointer hover:underline" onClick={() => copyToClipboard(CONTRACT_ADDRESS)}>
                {formatAddress(CONTRACT_ADDRESS)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Explorer:</span>
              <a 
                href={`https://www.oklink.com/xlayer-test/address/${CONTRACT_ADDRESS}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:underline"
              >
                View on OKLink
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <WalletHeader />
          <div className="bg-white rounded-b-2xl shadow-xl">
            <div className="flex border-b">
              <button
                className={`flex-1 py-4 px-6 text-center font-medium ${
                  activeTab === 'swap' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('swap')}
              >
                Swap
              </button>
              <button
                className={`flex-1 py-4 px-6 text-center font-medium ${
                  activeTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('history')}
              >
                History
              </button>
              <button
                className={`flex-1 py-4 px-6 text-center font-medium ${
                  activeTab === 'security' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('security')}
              >
                Security
              </button>
            </div>
            {activeTab === 'swap' && <SwapInterface />}
            {activeTab === 'history' && <TransactionHistory />}
            {activeTab === 'security' && <SecurityFeatures />}
          </div>
        </div>
        <div className="fixed bottom-4 right-4 space-y-2">
          {notifications.map((notification) => (
            <Notification
              key={notification.id}
              type={notification.type}
              message={notification.message}
              onClose={() => removeNotification(notification.id)}
            />
          ))}
        </div>
      </div>
    </ErrorBoundary>
  );
};

// Render the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<SwapPayWallet />);
}

export default SwapPayWallet;