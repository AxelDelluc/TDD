import { beforeEach, describe, expect, test } from "vitest";
import { CalculatePriceUseCase, ReductionGateway } from "./calcul-price.usecase";

class StubReductionGateway implements ReductionGateway {
    async getReductionByCode(code: string | undefined): Promise<{
        type: string;
        amount: number;
    }> {
        if (code === "percentile") {
            return {
                type: "PERCENTILE_REDUCTION",
                amount: 10
            }
        }
        return {
            type: "DIRECT_REDUCTION",
            amount: 10
        };
    }
}

describe("CalculatePriceUseCase", () => {
    let reductionGateway: StubReductionGateway;
    let calculatePrice: CalculatePriceUseCase;
    beforeEach(() => {
        reductionGateway = new StubReductionGateway();
        calculatePrice = new CalculatePriceUseCase(reductionGateway);
    });

    test("For one product with direct reduction", async () => {
        const result = await calculatePrice.execute([
            {
                price: 20,
                name: "product1",
                quantity: 1,
            },
        ])
        expect(result).toBe(10);
    });

    test("For one product with quantity > 1", async () => {
        const result = await calculatePrice.execute([
            {
                price: 20,
                name: "product1",
                quantity: 3,
            },
        ])
        expect(result).toBe(30);
    })

    test("For one product with direct reduction and a final price < 1", async () => {
        const result = await calculatePrice.execute([
            {
                price: 5,
                name: "product1",
                quantity: 1,
            },
        ])
        expect(result).toBe(1)
    })

    test("For two product with direct reduction", async () => {
        const result = await calculatePrice.execute([
            {
                price: 20,
                name: "product1",
                quantity: 1,
            },
            {
                price: 20,
                name: "product1",
                quantity: 1,
            }
        ])
        expect(result).toBe(20)
    })

    test("For one product with percentile reduction", async () => {
        const result = await calculatePrice.execute([
            {
                price: 20,
                name: "product1",
                quantity: 1,
            },
        ], "percentile")
        expect(result).toBe(18);
    })

    test("For one product with percentile reduction and a final price < 1", async () => {
        const result = await calculatePrice.execute([
            {
                price: 1,
                name: "product1",
                quantity: 1,
            },
        ], "percentile")
        expect(result).toBe(1);
    })

    test("For two product or more with percentile reduction", async () => {
        const result = await calculatePrice.execute([
            {
                price: 20,
                name: "product1",
                quantity: 1,
            },
            {
                price: 20,
                name: "product1",
                quantity: 1,
            }
        ], 'percentile')
        expect(result).toBe(36)
    })
});