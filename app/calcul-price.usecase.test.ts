import { beforeEach, describe, expect, test } from "vitest";
import {
	type DateProvider,
	type Discount,
	type NotificationGateway,
	type Product,
	type ReductionGateway,
	CalculatePriceUseCase,
} from "./calcul-price.usecase";

/*
notes tdd vite fait

test 1
panier simple
1 prod

test 2
2 prods
juste somme

test 3
quantity
fallait pas oublier le * quantity

refacto
sortir le calcul total dans une methode a part

test 4
promo fixe

test 5
jamais negatif

test 6
promo %

test 7
condition mini achat

test 8
promo sur type de produit

test 9
produit offert

test 10
ordre promo produit puis %

test 11
black friday date ok

test 12
black friday hors date

test 13
bf pas sous 1

test 14
ordre final promo puis bf
*/

class StubReductionGateway implements ReductionGateway {
	public reductions: Discount[] = [];

	async getReductionsByCodes(): Promise<Discount[]> {
		// stub simple
		return this.reductions;
	}
}

class SpyNotificationGateway implements NotificationGateway {
	public sentPrices: number[] = [];

	async sendFinalPrice(finalPrice: number): Promise<void> {
		// on garde trace de lappel
		this.sentPrices.push(finalPrice);
	}
}

class FakeDateProvider implements DateProvider {
	constructor(private currentDate: Date) {}

	now(): Date {
		return this.currentDate;
	}

	setDate(currentDate: Date) {
		this.currentDate = currentDate;
	}
}

describe("CalculatePriceUseCase", () => {
	let reductionGateway: StubReductionGateway;
	let notificationGateway: SpyNotificationGateway;
	let dateProvider: FakeDateProvider;
	let calculatePriceUseCase: CalculatePriceUseCase;

	beforeEach(() => {
		// reset a chaque test
		reductionGateway = new StubReductionGateway();
		notificationGateway = new SpyNotificationGateway();
		dateProvider = new FakeDateProvider(new Date("2025-10-10T10:00:00"));
		calculatePriceUseCase = new CalculatePriceUseCase(
			reductionGateway,
			notificationGateway,
			dateProvider,
		);
	});

	test("should return the price for one product", async () => {
		// test 1
		// cas le plus simple possible
		const products: Product[] = [
			{ name: "product1", price: 1, quantity: 1, type: "TSHIRT" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products);

		// total simple
		expect(finalPrice).toBe(1);

		// notif envoyée aussi
		expect(notificationGateway.sentPrices).toEqual([1]);
	});

	test("should return the total price for two products", async () => {
		// test 2
		// check somme de 2 lignes
		const products: Product[] = [
			{ name: "product1", price: 1, quantity: 1, type: "TSHIRT" },
			{ name: "product2", price: 1, quantity: 1, type: "PULL" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products);

		// 1 + 1
		expect(finalPrice).toBe(2);
		expect(notificationGateway.sentPrices).toEqual([2]);
	});

	test("should multiply price by quantity", async () => {
		// test 3
		// ici le piege c'est quantity
		const products: Product[] = [
			{ name: "product1", price: 1, quantity: 1, type: "TSHIRT" },
			{ name: "product2", price: 1, quantity: 2, type: "PULL" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products);

		// 1 + 2
		expect(finalPrice).toBe(3);
		expect(notificationGateway.sentPrices).toEqual([3]);
	});

	test("should apply a fixed price reduction", async () => {
		// test 4
		// promo prix fixe
		reductionGateway.reductions = [
			{ type: "PRICE_REDUCTION", code: "LESS5", amount: 5 },
		];

		const products: Product[] = [
			{ name: "product1", price: 10, quantity: 1, type: "TSHIRT" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products, ["LESS5"]);

		// 10 - 5
		expect(finalPrice).toBe(5);
		expect(notificationGateway.sentPrices).toEqual([5]);
	});

	test("should never reduce the total below zero with a fixed reduction", async () => {
		// test 5
		// garde fou metier
		reductionGateway.reductions = [
			{ type: "PRICE_REDUCTION", code: "LESS20", amount: 20 },
		];

		const products: Product[] = [
			{ name: "product1", price: 10, quantity: 1, type: "TSHIRT" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products, ["LESS20"]);

		// surtout pas negatif
		expect(finalPrice).toBe(0);
		expect(notificationGateway.sentPrices).toEqual([0]);
	});

	test("should apply a percentage reduction", async () => {
		// test 6
		// promo %
		reductionGateway.reductions = [
			{ type: "PERCENTAGE_REDUCTION", code: "PROMO10", amount: 10 },
		];

		const products: Product[] = [
			{ name: "product1", price: 10, quantity: 1, type: "TSHIRT" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products, ["PROMO10"]);

		// 10 - 10%
		expect(finalPrice).toBe(9);
		expect(notificationGateway.sentPrices).toEqual([9]);
	});

	test("should apply a reduction only if minimum price is reached", async () => {
		// test 7
		// condition mini non atteinte donc rien
		reductionGateway.reductions = [
			{
				type: "PERCENTAGE_REDUCTION",
				code: "PROMO10",
				amount: 10,
				minimumPrice: 30,
			},
		];

		const products: Product[] = [
			{ name: "product1", price: 10, quantity: 1, type: "TSHIRT" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products, ["PROMO10"]);

		// pas de reduc
		expect(finalPrice).toBe(10);
		expect(notificationGateway.sentPrices).toEqual([10]);
	});

	test("should apply a percentage reduction only on targeted product type", async () => {
		// test 8
		// promo juste tshirt
		reductionGateway.reductions = [
			{
				type: "PERCENTAGE_REDUCTION",
				code: "TSHIRT10",
				amount: 10,
				productType: "TSHIRT",
			},
		];

		const products: Product[] = [
			{ name: "tshirt", price: 10, quantity: 1, type: "TSHIRT" },
			{ name: "pull", price: 20, quantity: 1, type: "PULL" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products, [
			"TSHIRT10",
		]);

		// reduc seulement sur les 10 du tshirt
		expect(finalPrice).toBe(29);
		expect(notificationGateway.sentPrices).toEqual([29]);
	});

	test("should offer one tshirt for one tshirt bought", async () => {
		// test 9
		// ici on modelise en 2 achetes 1 offert pour que le calcul colle
		reductionGateway.reductions = [
			{
				type: "PRODUCT_OFFER",
				code: "TSHIRT_FREE",
				productType: "TSHIRT",
				buyQuantity: 2,
				freeQuantity: 1,
			},
		];

		const products: Product[] = [
			{ name: "tshirt", price: 20, quantity: 2, type: "TSHIRT" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products, [
			"TSHIRT_FREE",
		]);

		// 40 - 20
		expect(finalPrice).toBe(20);
		expect(notificationGateway.sentPrices).toEqual([20]);
	});

	test("should apply product offer before percentage reduction", async () => {
		// test 10
		// check ordre métier
		reductionGateway.reductions = [
			{
				type: "PRODUCT_OFFER",
				code: "TSHIRT_FREE",
				productType: "TSHIRT",
				buyQuantity: 2,
				freeQuantity: 1,
			},
			{
				type: "PERCENTAGE_REDUCTION",
				code: "PROMO10",
				amount: 10,
			},
		];

		const products: Product[] = [
			{ name: "tshirt", price: 20, quantity: 2, type: "TSHIRT" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products, [
			"TSHIRT_FREE",
			"PROMO10",
		]);

		// 40 -> 20 -> 18
		expect(finalPrice).toBe(18);
		expect(notificationGateway.sentPrices).toEqual([18]);
	});

	test("should apply black friday during the black friday period", async () => {
		// test 11
		// bonne date donc bf ok
		dateProvider.setDate(new Date("2025-11-29T12:00:00"));
		reductionGateway.reductions = [
			{ type: "BLACK_FRIDAY", code: "BLACKFRIDAY" },
		];

		const products: Product[] = [
			{ name: "product1", price: 100, quantity: 1, type: "PULL" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products, [
			"BLACKFRIDAY",
		]);

		// -50%
		expect(finalPrice).toBe(50);
		expect(notificationGateway.sentPrices).toEqual([50]);
	});

	test("should not apply black friday outside the black friday period", async () => {
		// test 12
		// mauvaise date donc rien
		dateProvider.setDate(new Date("2025-12-10T12:00:00"));
		reductionGateway.reductions = [
			{ type: "BLACK_FRIDAY", code: "BLACKFRIDAY" },
		];

		const products: Product[] = [
			{ name: "product1", price: 100, quantity: 1, type: "PULL" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products, [
			"BLACKFRIDAY",
		]);

		expect(finalPrice).toBe(100);
		expect(notificationGateway.sentPrices).toEqual([100]);
	});

	test("should never reduce the total below one euro with black friday", async () => {
		// test 13
		// autre garde fou metier
		dateProvider.setDate(new Date("2025-11-29T12:00:00"));
		reductionGateway.reductions = [
			{ type: "BLACK_FRIDAY", code: "BLACKFRIDAY" },
		];

		const products: Product[] = [
			{ name: "product1", price: 1, quantity: 1, type: "TSHIRT" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products, [
			"BLACKFRIDAY",
		]);

		// surtout pas 0.5
		expect(finalPrice).toBe(1);
		expect(notificationGateway.sentPrices).toEqual([1]);
	});

	test("should apply black friday after other promotions", async () => {
		// test 14
		// dernier check sur lordre final
		dateProvider.setDate(new Date("2025-11-29T12:00:00"));
		reductionGateway.reductions = [
			{ type: "PERCENTAGE_REDUCTION", code: "PROMO10", amount: 10 },
			{ type: "BLACK_FRIDAY", code: "BLACKFRIDAY" },
		];

		const products: Product[] = [
			{ name: "product1", price: 100, quantity: 1, type: "TSHIRT" },
		];

		const finalPrice = await calculatePriceUseCase.execute(products, [
			"PROMO10",
			"BLACKFRIDAY",
		]);

		// 100 -> 90 -> 45
		expect(finalPrice).toBe(45);
		expect(notificationGateway.sentPrices).toEqual([45]);
	});
});
