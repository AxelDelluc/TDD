export type ProductsType = "TSHIRT" | "PULL";

export type Product = {
	name: string;
	quantity: number;
	type: ProductsType;
	price: number;
};

export type ProductDiscount = {
	type: "PRODUCT_OFFER";
	code: string;
	productType: ProductsType;
	buyQuantity: number;
	freeQuantity: number;
};

export type PriceReductionDiscount = {
	type: "PRICE_REDUCTION";
	code: string;
	amount: number;
	minimumPrice?: number;
	productType?: ProductsType;
};

export type PercentageReductionDiscount = {
	type: "PERCENTAGE_REDUCTION";
	code: string;
	amount: number;
	minimumPrice?: number;
	productType?: ProductsType;
};

export type BlackFridayDiscount = {
	type: "BLACK_FRIDAY";
	code: string;
};

export type Discount =
	| ProductDiscount
	| PriceReductionDiscount
	| PercentageReductionDiscount
	| BlackFridayDiscount;

export interface ReductionGateway {
	getReductionsByCodes(codes: string[]): Promise<Discount[]>;
}

export interface NotificationGateway {
	sendFinalPrice(finalPrice: number): Promise<void>;
}

export interface DateProvider {
	now(): Date;
}

export class CalculatePriceUseCase {
	constructor(
		private readonly reductionGateway: ReductionGateway,
		private readonly notificationGateway: NotificationGateway,
		private readonly dateProvider: DateProvider,
	) {}

	async execute(products: Product[], codes: string[] = []): Promise<number> {
		// recup des codes promo
		const reductions = await this.reductionGateway.getReductionsByCodes(codes);

		// total brut de base
		let finalPrice = this.calculateProductsTotal(products);

		// ordre metier de l'enonce
		// 1 promos produit
		finalPrice = this.applyProductOfferReductions(finalPrice, products, reductions);

		// 2 promos prix fixe et %
		finalPrice = this.applyPriceAndPercentageReductions(
			finalPrice,
			products,
			reductions,
		);

		// 3 black friday a la fin
		finalPrice = this.applyBlackFriday(finalPrice, reductions);

		// propre pr eviter les decimales bizarres
		finalPrice = this.roundPrice(finalPrice);

		// notif avec prix final
		await this.notificationGateway.sendFinalPrice(finalPrice);

		return finalPrice;
	}

	private calculateProductsTotal(products: Product[]): number {
		// total simple du panier
		return products.reduce((total, product) => {
			return total + product.price * product.quantity;
		}, 0);
	}

	private calculateProductsTotalByType(
		products: Product[],
		productType: ProductsType,
	): number {
		// total mais juste sur un type
		return products
			.filter((product) => product.type === productType)
			.reduce((total, product) => total + product.price * product.quantity, 0);
	}

	private applyProductOfferReductions(
		currentPrice: number,
		products: Product[],
		reductions: Discount[],
	): number {
		// promos genre 2 achetes 1 offert
		const productOfferReductions = reductions.filter(
			(reduction): reduction is ProductDiscount =>
				reduction.type === "PRODUCT_OFFER",
		);

		return productOfferReductions.reduce((price, reduction) => {
			const matchingProducts = products.filter(
				(product) => product.type === reduction.productType,
			);

			const discountAmount = matchingProducts.reduce((discount, product) => {
				const numberOfFreeProducts =
					Math.floor(product.quantity / reduction.buyQuantity) *
					reduction.freeQuantity;

				return discount + numberOfFreeProducts * product.price;
			}, 0);

			// jamais negatif
			return Math.max(0, price - discountAmount);
		}, currentPrice);
	}

	private applyPriceAndPercentageReductions(
		currentPrice: number,
		products: Product[],
		reductions: Discount[],
	): number {
		// promo fixe ou pourcentage
		const priceAndPercentageReductions = reductions.filter(
			(reduction) =>
				reduction.type === "PRICE_REDUCTION" ||
				reduction.type === "PERCENTAGE_REDUCTION",
		);

		return priceAndPercentageReductions.reduce((price, reduction) => {
			// si ya une condition mini et quon la passe pas
			if (
				reduction.minimumPrice !== undefined &&
				price < reduction.minimumPrice
			) {
				return price;
			}

			if (reduction.type === "PRICE_REDUCTION") {
				// cas ciblé sur un type de produit
				if (reduction.productType !== undefined) {
					const eligibleAmount = this.calculateProductsTotalByType(
						products,
						reduction.productType,
					);

					// evite de retirer plus que la partie eligible
					const discountAmount = Math.min(reduction.amount, eligibleAmount);

					return Math.max(0, price - discountAmount);
				}

				// cas normal
				return Math.max(0, price - reduction.amount);
			}

			// pourcentage ciblé sur un type
			if (reduction.productType !== undefined) {
				const eligibleAmount = this.calculateProductsTotalByType(
					products,
					reduction.productType,
				);

				const discountAmount = (eligibleAmount * reduction.amount) / 100;

				return Math.max(0, price - discountAmount);
			}

			// pourcentage sur le prix courant
			const discountAmount = (price * reduction.amount) / 100;

			return Math.max(0, price - discountAmount);
		}, currentPrice);
	}

	private applyBlackFriday(currentPrice: number, reductions: Discount[]): number {
		// on check si le code bf est la
		const hasBlackFridayReduction = reductions.some(
			(reduction) => reduction.type === "BLACK_FRIDAY",
		);

		if (!hasBlackFridayReduction) {
			return currentPrice;
		}

		// si pas la bonne date on touche a rien
		if (!this.isBlackFridayPeriod(this.dateProvider.now())) {
			return currentPrice;
		}

		// -50% mais jamais sous 1€
		return Math.max(1, currentPrice / 2);
	}

	private isBlackFridayPeriod(date: Date): boolean {
		// periode donnée dans l'enonce
		const start = new Date("2025-11-28T00:00:00");
		const end = new Date("2025-11-30T23:59:59");

		return date >= start && date <= end;
	}

	private roundPrice(price: number): number {
		// pr eviter des 18.0000000002 etc
		return Math.round(price * 100) / 100;
	}
}
