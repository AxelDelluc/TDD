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
      p.price = this.applyReduction(reduction, p.price);
    })

    return product.reduce(
      (price, product) => product.price * product.quantity + price,
      0,
    );
  }

  private applyReduction(reduction: { type: string, amount: number }, price: number): number {
    switch (reduction.type) {
      case 'DIRECT_REDUCTION': {
        price = price - reduction.amount;
        if (price < 1) {
          price = 1
        }
        break;
      }
      case 'PERCENTILE_REDUCTION': {
        price = price - (price * (reduction.amount / 100))
        if (price < 1) {
          price = 1
        }
        break;
      }
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