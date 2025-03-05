import { describe, expect, it, beforeAll } from "vitest";
import { ElizaOSApiClient } from "./utils/elizaApiClient";
import { ElizaOSPrompt } from "./types";
import * as dotenv from "dotenv";
import { NetworkClientWrapper } from "./utils/testnetClient";
import { AccountData } from "./utils/testnetUtils";

interface TestCase {
    promptText: string;
    holders: { accountId: string; balance: string }[];
}
describe("get_list_of_token_holders", () => {
    let acc1: AccountData;
    let acc2: AccountData;
    let acc3: AccountData;
    let token1: string;
    let token2: string;
    let elizaOsApiClient: ElizaOSApiClient;
    let testCases: TestCase[];
    let tresholdTestCases: TestCase[];
    let networkClientWrapper: NetworkClientWrapper;

    beforeAll(async () => {
        dotenv.config();
        try {
            networkClientWrapper = new NetworkClientWrapper(
                process.env.HEDERA_ACCOUNT_ID!,
                process.env.HEDERA_PRIVATE_KEY!,
                process.env.HEDERA_KEY_TYPE!,
                "testnet"
            );

            await Promise.all([
                networkClientWrapper.createAccount(0, -1),
                networkClientWrapper.createAccount(0, -1),
                networkClientWrapper.createAccount(0, -1),
            ]).then(([account1, account2, account3]) => {
                acc1 = account1;
                acc2 = account2;
                acc3 = account3;
            });

            await Promise.all([
                networkClientWrapper.createFT({
                    name: "MyToken1",
                    symbol: "MTK1",
                    initialSupply: 1000,
                    decimals: 2,
                }),
                networkClientWrapper.createFT({
                    name: "MyToken2",
                    symbol: "MTK2",
                    initialSupply: 1000,
                    decimals: 2,
                }),
            ]).then(([t1, t2]) => {
                token1 = t1;
                token2 = t2;
            });

            await Promise.all([
                networkClientWrapper.transferToken(acc1.accountId, token1, 10),
                networkClientWrapper.transferToken(acc2.accountId, token1, 20),
                networkClientWrapper.transferToken(acc3.accountId, token1, 30),
                networkClientWrapper.transferToken(acc1.accountId, token2, 40),
                networkClientWrapper.transferToken(acc2.accountId, token2, 50),
                networkClientWrapper.transferToken(acc3.accountId, token2, 60),
            ]);

            elizaOsApiClient = new ElizaOSApiClient(
                `http://${process.env.ELIZAOS_REST_HOSTNAME}:${process.env.ELIZAOS_REST_PORT}`
            );
            await elizaOsApiClient.setup();

            testCases = [
                {
                    holders: [
                        { accountId: acc1.accountId, balance: "0.1" },
                        { accountId: acc2.accountId, balance: "0.2" },
                        { accountId: acc3.accountId, balance: "0.3" },
                        {
                            accountId: networkClientWrapper.getAccountId(),
                            balance: "9.4",
                        },
                    ],
                    promptText: `Who owns token ${token1} and what are their balances?`,
                },
                {
                    holders: [
                        { accountId: acc1.accountId, balance: "0.4" },
                        { accountId: acc2.accountId, balance: "0.5" },
                        { accountId: acc3.accountId, balance: "0.6" },
                        {
                            accountId: networkClientWrapper.getAccountId(),
                            balance: "8.5",
                        },
                    ],
                    promptText: `Who owns token ${token2} and what are their balances?`,
                },
            ];

            tresholdTestCases = [
                {
                    holders: [
                        { accountId: acc3.accountId, balance: "0.3" },
                        {
                            accountId: networkClientWrapper.getAccountId(),
                            balance: "9.4",
                        },
                    ],
                    promptText: `Which wallets hold token ${token1} and have at least 0.3 tokens?`,
                },
                {
                    holders: [
                        { accountId: acc3.accountId, balance: "0.6" },
                        {
                            accountId: networkClientWrapper.getAccountId(),
                            balance: "8.5",
                        },
                    ],
                    promptText: `Show me the token holders for ${token2} with balances greater or equal 0.6.`,
                },
            ];
        } catch (error) {
            console.error("Error in setup:", error);
            throw error;
        }
    });

    describe("get list of token holders checks", () => {
        it("should get list of token holders", async () => {
            for (const { promptText, holders } of testCases) {
                const prompt: ElizaOSPrompt = {
                    user: "user",
                    text: promptText,
                };

                const response = await elizaOsApiClient.sendPrompt(prompt);
                const lastMessage =
                    // @ts-expect-error -- type from sendPrompt doesn't include holdersArray
                    response[response.length - 1].content.holdersArray as {
                        account: string;
                        balance: number;
                        decimals: number;
                    }[];

                expect(lastMessage.length).toBe(holders.length);

                lastMessage.forEach((holder) => {
                    const relevantHolder = holders.find(
                        (h) => h.accountId === holder.account
                    );
                    expect(relevantHolder?.balance).toEqual(holder.balance);
                    expect(relevantHolder?.accountId).toEqual(holder.account);
                });
            }
        });

        it("should get list of token holders with treshold", async () => {
            for (const { promptText, holders } of tresholdTestCases) {
                const prompt: ElizaOSPrompt = {
                    user: "user",
                    text: promptText,
                };

                const response = await elizaOsApiClient.sendPrompt(prompt);
                const lastMessage =
                    // @ts-expect-error -- type from sendPrompt doesn't include holdersArray
                    response[response.length - 1].content.holdersArray as {
                        account: string;
                        balance: number;
                        decimals: number;
                    }[];

                expect(lastMessage.length).toBe(holders.length);

                lastMessage.forEach((holder) => {
                    const relevantHolder = holders.find(
                        (h) => h.accountId === holder.account
                    );
                    expect(relevantHolder?.balance).toEqual(holder.balance);
                    expect(relevantHolder?.accountId).toEqual(holder.account);
                });
            }
        });
    });
});
