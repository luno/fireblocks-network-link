import { randomUUID } from 'crypto';
import Client from '../../src/client';
import {
  Account,
  AssetReference,
  Layer1Cryptocurrency,
  Layer2Cryptocurrency,
  NationalCurrencyCode,
  Quote,
  QuoteCapabilities,
  QuoteRequest,
  QuoteStatus,
} from '../../src/client/generated';
import config from '../../src/config';
import { describeif } from '../conditional-tests';
import { fail } from 'jest-extended';

const shouldTestLiquidity = !!config.get('capabilities.components.liquidity');

describeif(shouldTestLiquidity, 'Liquidity', () => {
  let client: Client;
  let capabilitiesResponse: QuoteCapabilities;
  let account: Account;

  beforeAll(async () => {
    client = new Client();
    capabilitiesResponse = await client.capabilities.getQuoteCapabilities({});
  });

  describe('Capabilities', () => {
    it('every capability should have valid asset reference in from and to assets', () => {
      expectValidQuoteCapabilitiesAssets(capabilitiesResponse);
    });
  });

  describe('List quotes', () => {
    let allQuotes: Quote[];

    beforeAll(async () => {
      allQuotes = await getAllQuotes(account.id);
    });

    it('every quote should be found on getQuoteDetails', async () => {
      for (const quote of allQuotes) {
        expectValidQuote(account.id, quote);
      }
    });
  });

  describe('Create quote', () => {
    let createdQuote: Quote;
    let quoteRequest: QuoteRequest;

    describe('With valid request', () => {
      afterEach(async () => {
        expect(async () => {
          await client.liquidity.getQuoteDetails({ accountId: account.id, id: createdQuote.id });
        }).not.toThrow();
      });
      it('should work with fromAmount', async () => {
        quoteRequest = { ...capabilitiesResponse.capabilities[0], fromAmount: '1' };
        expect(async () => {
          createdQuote = await client.liquidity.createQuote({
            accountId: account.id,
            requestBody: quoteRequest,
          });
        }).not.toThrow();
      });
      it('should work with toAmount', () => {
        quoteRequest = { ...capabilitiesResponse.capabilities[0], toAmount: '1' };
        expect(async () => {
          createdQuote = await client.liquidity.createQuote({
            accountId: account.id,
            requestBody: quoteRequest,
          });
        }).not.toThrow();
      });
    });

    describe('With invalid request', () => {
      it('should fail when specifying fromAmount and toAmount', () => {
        quoteRequest = { ...capabilitiesResponse.capabilities[0], toAmount: '1', fromAmount: '1' };
        expect(async () => {
          await client.liquidity.createQuote({
            accountId: account.id,
            requestBody: quoteRequest,
          });
        }).toThrow();
      });
      it('should fail when using invalid asset in either fromAsset or toAsset', () => {
        quoteRequest = {
          fromAsset: { assetId: randomUUID() },
          toAsset: { assetId: randomUUID() },
          toAmount: '1',
        };
        expect(async () => {
          await client.liquidity.createQuote({
            accountId: account.id,
            requestBody: quoteRequest,
          });
        }).toThrow();
      });
    });
  });

  describe('Execute quote', () => {
    let executedQuote: Quote;

    beforeAll(async () => {
      const createdQuote = await client.liquidity.createQuote({ accountId: account.id });
      executedQuote = await client.liquidity.executeQuote({
        id: createdQuote.id,
        accountId: account.id,
      });
    });

    it('should have quote status changed to executing / executed', () => {
      expect([QuoteStatus.EXECUTED, QuoteStatus.EXECUTING]).toContain(executedQuote.status);
    });

    it('should find quote on getQuoteDetails post execution', () => {
      // TODO
    });
  });
});

async function isValidAssetReference(assetReference: AssetReference): Promise<boolean> {
  if ('nationalCurrencyCode' in assetReference) {
    return Object.values(NationalCurrencyCode).includes(assetReference.nationalCurrencyCode);
  }

  if ('cryptocurrencySymbol' in assetReference) {
    return [
      ...Object.values(Layer1Cryptocurrency),
      ...Object.values(Layer2Cryptocurrency),
    ].includes(assetReference.cryptocurrencySymbol);
  }

  const client = new Client();
  try {
    const asset = await client.capabilities.getAssetDetails({ id: assetReference.assetId });
    return asset && asset.id === assetReference.assetId;
  } catch (err) {
    return false;
  }
}

async function expectValidQuoteCapabilitiesAssets(
  quoteCapabilities: QuoteCapabilities
): Promise<void> {
  for (const quoteCapability of quoteCapabilities.capabilities) {
    if (!(await isValidAssetReference(quoteCapability.fromAsset))) {
      expect().fail(
        `Invalid fromAsset in quote capabilities: ${JSON.stringify(quoteCapability.fromAsset)}`
      );
    }
    if (!(await isValidAssetReference(quoteCapability.toAsset))) {
      expect().fail(
        `Invalid fromAsset in quote capabilities: ${JSON.stringify(quoteCapability.toAsset)}`
      );
    }
  }
}

async function expectValidQuote(accountId: string, quote: Quote): Promise<void> {
  const client = new Client();
  try {
    const quoteDetails = await client.liquidity.getQuoteDetails({ accountId, id: quote.id });
    if (!quoteDetails || quoteDetails.id !== quote.id) {
      expect().fail(`Did not find quote ${quote.id} on server`);
    }
  } catch (err) {
    expect().fail(
      `Received error from server for getQuoteDetails with quote ${quote.id}: ${err.message}`
    );
  }
}

async function getAllQuotes(accountId: string): Promise<Quote[]> {
  const client = new Client();
  const limit = 200;
  let startingAfter;
  let result: Quote[] = [];

  while (true) {
    const page = await client.liquidity.getQuotes({ accountId, limit, startingAfter });
    result = [...result, ...page.quotes];
    if (limit > page.quotes.length) {
      break;
    }
    startingAfter = page.quotes[page.quotes.length - 1].id;
  }

  return result;
}
