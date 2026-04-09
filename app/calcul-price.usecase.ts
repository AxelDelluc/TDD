export type ProductsType = "TSHIRT" | "PULL";

export type Product = {
  name: string;
  quantity: number;
  type: ProductsType;
  price: number;
};

export type Discount = {
  type: string;
};

export class CalculatePriceUseCase {
  constructor(private reductionGateway: ReductionGateway) { }

  async execute(
    product: { price: number; name: string; quantity: number }[],
    code?: string,
  ) {
    const reduction = await this.reductionGateway.getReductionByCode(code);

    product.forEach((p) => {
      p.price = this.applyReduction(reduction, p.price, p.quantity);
    })

    return product.reduce(
      (price, product) => product.price * product.quantity + price,
      0,
    );
  }

  private applyReduction(reduction: { type: string, amount: number }, price: number, quantity: number): number {
    switch (reduction.type) {
      case 'DIRECT_REDUCTION': {
        price = price - reduction.amount;
        break;
      }
      case 'PERCENTILE_REDUCTION': {
        price = price - (price * (reduction.amount / 100))
        break;
      }
      case '2_FOR_1': {
        if (quantity % 2 === 0) {
          price = price / 2
        }
        break;
      }
    }
    if (price < 1) {
      price = 1
    }
    return price;
  }
}

export interface ReductionGateway {
  getReductionByCode(code: string | undefined): Promise<{
    type: string;
    amount: number;
  }>;
}