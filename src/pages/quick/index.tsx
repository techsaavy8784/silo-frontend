import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Container from '../../components/Container';
import { APP_NAME_URL, APP_SHORT_BLURB } from '../../constants';
import Head from 'next/head';
import Button from '../../components/Button';
import CurrencyInputPanel from '../../components/CurrencyInputPanel';
import NoTokenCurrencyInputPanel from '../../components/NoTokenCurrencyInputPanel';
import useSiloMarkets from '../../hooks/useSiloMarkets';
import { useTransactionAdder } from '../../state/transactions/hooks';
import useTokenSetup from '../../hooks/useTokenSetup';
import { useActiveWeb3React } from '../../hooks';
import { Field } from '../../state/swap/actions';
import { t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { deDecimal, tryParseAmountToString, tryParseBorrowToString } from '../../functions';
import {
  useSiloBridgePoolContract,
  useSiloContract,
  useTokenContract,
  useSiloRouterContract,
  useSiloOracleContract,
} from '../../hooks/useContract';
import { JSBI, WNATIVE } from '@sushiswap/sdk';
import Web3Status from '../../components/Web3Status';
import SiloPosistions from '../../components/SiloPositions';
import { SiloInfo, SiloRouterPosistion, SiloUserInfo } from '../../types/SiloTypes';
import { ethers } from 'ethers';
import SupportedSilos from '../../components/SupportedSilos';

/**
 * TODO:
 * 1) test "path in todo below"
 */

const callOptions = { gasLimit: 1000000 };

export default function Lending() {
  const {
    independentField,
    showWrap,
    formattedAmounts,
    showMaxButton,
    currencies,
    handleTypeInput,
    handleMaxInput,
    fiatValueInput,
    handleInputSelect,
    handleOutputSelect,
  } = useTokenSetup();

  const { createSiloMarket, tokenInSilo, currentSilo, currentOutSilo } = useSiloMarkets();
  const addTransaction = useTransactionAdder();
  const { chainId, account } = useActiveWeb3React();
  const { i18n } = useLingui();

  //TODO: memo all this, with the parse
  const selected: any = currencies[Field.INPUT];
  const selectedOut: any = currencies[Field.OUTPUT];
  const tokenAddress = selected?.address;
  const tokenAddressOut = selectedOut?.address;
  const amount = formattedAmounts.INPUT;
  const amountOut = formattedAmounts.OUTPUT;
  const siloBridgePool = useSiloBridgePoolContract(true);
  const tokenContract = useTokenContract(currentSilo && currentSilo.assetAddress, true);
  const siloContract = useSiloContract(currentSilo && currentSilo.address, true);
  const siloOracleContract = useSiloOracleContract(true);
  // const siloAssetContract = useTokenContract(currentSilo && currentSilo.address, true);
  const siloRouterContract = useSiloRouterContract(true);
  // const [approvalState, approve] = useApproveCallback(amount, currentSilo && currentSilo.address);
  const wrappedNative = WNATIVE[chainId];
  const nativeTokenContract = useTokenContract(wrappedNative.address, true);
  const [currentSiloInfo, setCurrentSiloInfo] = useState<SiloInfo | null>(null);
  const [currentSiloUserInfo, setCurrentSiloUserInfo] = useState<SiloUserInfo | null>(null);

  const [depositVal, setDepositVal] = useState(null);
  const [borrowVal, setBorrowVal] = useState(null);
  const [nativeVal, setNativeVal] = useState(null);

  // if a token is selected, lets check if in a silo, and set the current silo
  useEffect(() => {
    if (tokenAddress) tokenInSilo(tokenAddress);
  }, [tokenAddress, tokenInSilo]);

  useEffect(() => {
    if (tokenAddressOut) tokenInSilo(tokenAddressOut, true);
  }, [tokenAddressOut, tokenInSilo]);

  //TODO: batch this with promise.all() or use lib to batch
  //TODO: should pull stale'ish values from the graph, then after interval fetch to be efficent
  //      or graph values are always up to date
  // for the current silo, pickup the current contract data values
  const fetchCurrentSiloData = useCallback(async () => {
    const siloInfo: SiloInfo = {};
    siloInfo.lastUpdateTimestamp = await siloContract.lastUpdateTimestamp();
    siloInfo.interestRate = await siloContract.interestRate();
    siloInfo.protocolFees = await siloContract.protocolFees();
    siloInfo.totalBorrowAmount = await siloContract.totalBorrowAmount();
    siloInfo.totalBorrowShare = await siloContract.totalBorrowShare();
    siloInfo.totalDeposits = await siloContract.totalDeposits();
    siloInfo.liquidity = await siloContract.liquidity();
    setCurrentSiloInfo(siloInfo);
  }, [siloContract]);

  const fetchCurrentSiloUserData = useCallback(async () => {
    if (currentSilo) {
      const userInfo: SiloUserInfo = {};
      console.log('getting current user silo data');
      console.log('user address:', account);
      userInfo.address = account;
      userInfo.underlyingBalance = await siloContract.balanceOfUnderlying(account);
      userInfo.underlyingBridgeBalance = await siloBridgePool.balanceOfUnderlying(currentSilo.address, account);
      // userInfo.isSolvent = await siloContract.isSolvent(account);
      // userInfo.collaterilizationLevel = await siloContract.getCollateralization(account);
      // userInfo.debtLevel = await siloContract.getDebtValue(account);
      setCurrentSiloUserInfo(userInfo);
    }
  }, [account, currentSilo, siloBridgePool, siloContract]);

  // if we have a silo, lets get the current data off the silo
  useEffect(() => {
    if (currentSilo) {
      console.log('getting silo data and silo user data');
      fetchCurrentSiloData();
      fetchCurrentSiloUserData();
    }
  }, [currentSilo, fetchCurrentSiloData, fetchCurrentSiloUserData]);

  const consoleState = () => {
    console.log('selected:', selected);
    console.log('selectedOut', selectedOut);
    console.log('tokenAddress:', tokenAddress);
    console.log('amount:', amount);
    console.log('parsedAmt:', parsedAmt);
    console.log('parsedAmt:', parsedAmt);
    console.log('parseOutAmt:', parsedAmtOut);
    console.log('current silo:', currentSilo);
    console.log('current Out silo:', currentOutSilo);
    console.log('native asset on this chain is:', wrappedNative);
  };

  const parsedAmt = amount && selected && tryParseAmountToString(amount, selected);
  const parsedAmtOut = amountOut && selectedOut && tryParseAmountToString(amountOut, selectedOut);
  const parsedBorrow = tryParseBorrowToString(borrowVal, selectedOut);

  // console.log('parsedBorrowVal', parsedBorrow);
  // console.log('borrowVal', borrowVal?.toString());
  // console.log('amount:', amount);

  const quickBorrowPreload = () => {
    const rp1: SiloRouterPosistion = {};
    rp1.collateral = currentSilo.assetAddress;
    rp1.borrow = nativeTokenContract.address;
    // rp1.ethSilo = ethers.constants.AddressZero;
    const rp2: SiloRouterPosistion = {};
    rp2.collateral = nativeTokenContract.address;
    rp2.borrow = currentOutSilo.assetAddress;
    // rp2.ethSilo = currentOutSilo.address;
    return [rp1, rp2];
  };

  const quickBorrow = async (rp1: SiloRouterPosistion, rp2: SiloRouterPosistion) => {
    if (currentSilo && selected && selectedOut && parsedAmt) {
      console.log([rp1, rp2]);
      const result = await siloRouterContract.borrow([rp1, rp2]);

      addTransaction(result, {
        summary: `QuickBorrow collateral - silo market ${currentSilo.symbol} borrow - ${currentOutSilo.symbol}`,
      });
    } else {
      console.warn('both silos are not selected or amount not entered');
    }
  };

  const multByNum = useCallback((val, num) => {
    let temp = JSBI.multiply(val, JSBI.BigInt(num));
    return deDecimal(temp);
  }, []);

  const divByNum = (val, num) => {
    return JSBI.divide(val, JSBI.BigInt(num));
  };

  const bnMult = useCallback((val1, val2) => {
    const temp = JSBI.multiply(val1, val2);
    return deDecimal(temp);
  }, []);

  const frtnDecConsole = useCallback((text, val, decimals = 14) => {
    console.log(`${text} (${decimals} dec):`, deDecimal(val, decimals).toString());
  }, []);

  /**  TODO: just verify the path
            1.  - oracled asset a, gives asset b $ equivalent
            2a. - a$ -> b$, you have b$max, you then have bLiquidtymax
            2b. - a$ -> native$, b$ -> native$, gives a$native -> b$native ratio
            2c. - maxout b$native while less than b$max and bLiquiditymax
            3.  - pre-load asset b available liquidity (otherwise this is max)
            4.  - this and borrow + lend should be checking collateral level, and that there is liquidity
 *               on both sides of the silo(s)
      */

  const calculateOracledValues = useCallback(async () => {
    const oraclePriceForAssetA = await siloOracleContract.getPriceStatic(tokenAddress, callOptions);
    // const oraclePriceForAssetA = await siloOracleContract.getPrice(tokenAddress);
    // console.log('getting oracle price for token B:', tokenAddressOut);
    // frtnDecConsole('oracle value of A', oraclePriceForAssetA);

    const oraclePriceForAssetB = await siloOracleContract.getPriceStatic(tokenAddressOut, callOptions);
    // console.log('getting oracle price for native token:', nativeTokenContract.address);
    const oraclePriceForNative = await siloOracleContract.getPriceStatic(nativeTokenContract.address, callOptions);
    // await oraclePriceForAssetB.wait();
    const bnOraclePriceAssetA = JSBI.BigInt(oraclePriceForAssetA);
    const bnOraclePriceAssetB = JSBI.BigInt(oraclePriceForAssetB);
    const bnOraclePriceNativeAsset = JSBI.BigInt(oraclePriceForNative);

    /** critical need oracle values to proceed */

    frtnDecConsole('oracle value of A', bnOraclePriceAssetA);
    frtnDecConsole('oracle value of B', bnOraclePriceAssetB);
    frtnDecConsole('oracle value of native', bnOraclePriceNativeAsset);

    if (
      !(
        JSBI.greaterThan(bnOraclePriceAssetA, JSBI.BigInt(0)) &&
        JSBI.greaterThan(bnOraclePriceAssetB, JSBI.BigInt(0)) &&
        JSBI.greaterThan(bnOraclePriceNativeAsset, JSBI.BigInt(0))
      )
    ) {
      console.error('price oracle failed for either assetB or native asset');
      return;
    }

    frtnDecConsole('oracle value of A', bnOraclePriceAssetA);
    frtnDecConsole('oracle value of B', bnOraclePriceAssetB);
    frtnDecConsole('oracle value of native', bnOraclePriceNativeAsset);
    console.log('amt A', amount);
    console.log('amt B', amountOut);

    let valueA = multByNum(bnOraclePriceAssetA, parsedAmt);
    let valueB = multByNum(bnOraclePriceAssetB, parsedAmtOut);

    frtnDecConsole('value of A', valueA);
    frtnDecConsole('value of B', valueB);

    const maxBorrowB = divByNum(valueB, 200);
    let nativeAmount = divByNum(valueB, 4);
    nativeAmount = bnMult(nativeAmount, bnOraclePriceNativeAsset);

    frtnDecConsole('borrow on B', maxBorrowB);
    frtnDecConsole('native amount to borrow on B', nativeAmount);

    setBorrowVal(maxBorrowB);
    setNativeVal(nativeAmount);
  }, [
    amount,
    amountOut,
    bnMult,
    frtnDecConsole,
    multByNum,
    nativeTokenContract.address,
    parsedAmt,
    parsedAmtOut,
    siloOracleContract,
    tokenAddress,
    tokenAddressOut,
  ]);

  //calculate values on change
  useEffect(() => {
    if (amount && amountOut && tokenAddress && tokenAddressOut && nativeTokenContract) {
      calculateOracledValues();
    }

    //TODO: fixme, workaround for no value
    if (!amount) {
      setBorrowVal(JSBI.BigInt(0));
    }
  }, [tokenAddress, tokenAddressOut, nativeTokenContract, amount, amountOut, calculateOracledValues]);

  const doCalculatedQuickBorrow = async () => {
    console.log('doCalculatedQuickBorrow()');

    if (currentSilo && currentOutSilo && amount && amountOut) {
      const [rp1, rp2] = quickBorrowPreload();
      rp1.depositAmount = parsedAmt.toString();
      rp1.borrowAmount = nativeVal.toString();
      rp2.depositAmount = nativeVal.toString();
      rp2.borrowAmount = borrowVal.toString();

      await quickBorrow(rp1, rp2);
    } else {
      console.warn('silos not selected, or value not entered for collateral silo');
    }
  };

  // no chain, no page
  if (!chainId) return null;

  return (
    <>
      <Container id="supply-page" className="pt-12 md:pt-14 lg:pt-16">
        <Head>
          <title>{APP_NAME_URL}</title>
          <meta key="description" name="description" content={APP_SHORT_BLURB} />
        </Head>
        <div className="p-4 pb-6 rounded-lg shadow-lg bg-dark-900 text-secondary">
          <h1 className="text-xl font-semibold">Quick Borrow </h1>

          <div className="text-xs font-thin mt-4 flex">
            {currentSilo && currentOutSilo && amount && amountOut && (
              <>
                <div>
                  Deposit {currentSilo.symbol} {'->'} Borrow {wrappedNative.symbol}
                </div>
                <div className="ml-4">{'---->'}</div>
                <div className="ml-4">
                  Deposit {wrappedNative.symbol} {'->'} Borrow {currentOutSilo.symbol}
                </div>
              </>
            )}
          </div>

          <div className="mt-4">
            <CurrencyInputPanel
              // priceImpact={priceImpact}
              label={
                independentField === Field.OUTPUT && !showWrap
                  ? i18n._(t`Select Collateral Silo:`)
                  : i18n._(t`Select Collateral Silo:`)
              }
              value={formattedAmounts[Field.INPUT]}
              showMaxButton={showMaxButton}
              currency={currencies[Field.INPUT]}
              onUserInput={handleTypeInput}
              onMax={handleMaxInput}
              fiatValue={fiatValueInput ?? undefined}
              onCurrencySelect={handleInputSelect}
              otherCurrency={currencies[Field.OUTPUT]}
              showCommonBases={false}
              id="swap-currency-input"
              hideBalance={false}
              hideInput={false}
            />
          </div>
          {/*} <div className="mt-2">
            <CurrencyInputPanel
              // priceImpact={priceImpact}
              label={
                independentField === Field.OUTPUT && !showWrap
                  ? i18n._(t`Select Borrow Silo:`)
                  : i18n._(t`Select Borrow Silo:`)
              }
              value={formattedAmounts[Field.OUTPUT]}
              showMaxButton={false}
              currency={currencies[Field.OUTPUT]}
              onUserInput={handleTypeInput}
              onMax={handleMaxInput}
              fiatValue={fiatValueInput ?? undefined}
              onCurrencySelect={handleOutputSelect}
              otherCurrency={currencies[Field.INPUT]}
              showCommonBases={false}
              id="swap-currency-output"
              hideBalance={false}
              hideInput={false}
            />
            </div> */}
          <div className="flex bg-dark-900">
            <div className="mt-2 ">
              <CurrencyInputPanel
                // priceImpact={priceImpact}
                label={
                  independentField === Field.OUTPUT && !showWrap
                    ? i18n._(t`Select Borrow Silo:`)
                    : i18n._(t`Select Borrow Silo:`)
                }
                value={formattedAmounts[Field.OUTPUT]}
                showMaxButton={false}
                currency={currencies[Field.OUTPUT]}
                onUserInput={handleTypeInput}
                onMax={handleMaxInput}
                fiatValue={fiatValueInput ?? undefined}
                onCurrencySelect={handleOutputSelect}
                otherCurrency={currencies[Field.INPUT]}
                showCommonBases={false}
                id="swap-currency-output"
                hideBalance={false}
                hideInput={true}
              />
            </div>
            <div className="mt-2 w-full bg-dark-900">
              <NoTokenCurrencyInputPanel
                id="borrow-value"
                value={parsedBorrow}
                currency={currencies[Field.OUTPUT]}
                showMaxButton={false}
                // priceImpact={priceImpact}
              />
            </div>
          </div>
          <div className="mt-2">
            {account ? (
              <div className="flex space-x-2">
                <Button
                  className="opacity-30"
                  type="button"
                  color="blue"
                  variant="outlined"
                  onClick={async () => {
                    console.log('Silo.approve()');

                    if (tokenAddress && currentSilo && amount) {
                      const result = await tokenContract.approve(siloRouterContract.address, parsedAmt);
                    } else {
                      console.warn('no current silo or value');
                    }
                  }}
                >
                  Approve
                </Button>
                <Button onClick={doCalculatedQuickBorrow} color="darkindigo">
                  Quick Borrow
                </Button>
              </div>
            ) : (
              <Web3Status />
            )}
          </div>
        </div>
      </Container>
      <Container className="py-2 md:py-4 lg:py-6">
        {currentSilo && wrappedNative && currentSiloUserInfo && (
          <SiloPosistions
            currentSilo={currentSilo}
            wrappedNative={wrappedNative}
            currentSiloUserInfo={currentSiloUserInfo}
          />
        )}
      </Container>
    </>
  );
}
