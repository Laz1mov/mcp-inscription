// API response types
export interface BlockstreamBlock {
  id: string;
  height: number;
  hash: string;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  previousblockhash: string;
  mediantime: number;
  merkle_root: string;
  nonce: number;
  bits: number;
  difficulty: number;
}

export interface BlockstreamTxStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

export interface BlockstreamTxPrevout {
  value: number;
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
}

export interface BlockstreamTxVin {
  txid: string;
  vout: number;
  prevout?: BlockstreamTxPrevout;
  scriptsig: string;
  scriptsig_asm: string;
  witness?: string[];
  is_coinbase: boolean;
  sequence: number;
}

export interface BlockstreamTxVout {
  value: number;
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address?: string;
}

export interface BlockstreamTx {
  txid: string;
  version: number;
  locktime: number;
  vin: BlockstreamTxVin[];
  vout: BlockstreamTxVout[];
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}
