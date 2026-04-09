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
      p = this.applyReduction(reduction, p);
    })

    return product.reduce(
      (price, product) => product.price * product.quantity + price,
      0,
    );
  }

  private applyReduction(reduction: { type: string, amount: number }, product: { price: number; name: string; quantity: number }): any {
    switch (reduction.type) {
      case 'DIRECT_REDUCTION': {
        product.price = product.price - reduction.amount;
        break;
      }
      case 'PERCENTILE_REDUCTION': {
        product.price = product.price - (product.price * (reduction.amount / 100))
        break;
      }
      case '2_FOR_1': {
        if (product.quantity % 2 === 0) {
          product.quantity = product.quantity / 2
        } else {
          const tmp = product.quantity - 1;
          product.quantity = 1 + (tmp / 2)
        }
        break;
      }
    }
    if (product.price < 1) {
      product.price = 1
    }
    return product
  }
}

export interface ReductionGateway {
  getReductionByCode(code: string | undefined): Promise<{
    type: string;
    amount: number;
  }>;
}