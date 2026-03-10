export type ExtendedTradingConfig = {
  minOrderSize: number;
  minOrderSizeChange: number;
  minPriceChange: number;
  maxNumOrders?: number;
  limitPriceCap?: number;
  limitPriceFloor?: number;
  maxMarketOrderValue?: number;
  maxLimitOrderValue?: number;
  maxPositionValue?: number;
  maxLeverage?: number;
};

export type ExtendedMarketSnapshot = {
  market: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  nextFundingRateTimestampMs?: number;
  openInterestUsd?: number;
  dailyVolumeUsd?: number;
  tradingConfig: ExtendedTradingConfig;
};

export type ExtendedFundingPoint = {
  timestamp: number;
  fundingRate: number;
};

export type ExtendedUserFees = {
  market: string;
  makerFeeRate: number;
  takerFeeRate: number;
  builderFeeRate?: number;
};
