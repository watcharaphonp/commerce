import { HIDDEN_PRODUCT_TAG, SHOPIFY_GRAPHQL_API_ENDPOINT, TAGS } from 'lib/constants';
import { ensureStartsWith } from 'lib/utils';
import { revalidateTag } from 'next/cache';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import cartList from '../../database/carts.json';
import categoryList from '../../database/categories.json';
import collectionList from '../../database/collections.json';
import productList from '../../database/products.json';
import { editCartItemsMutation, removeFromCartMutation } from './mutations/cart';
import {
  Cart,
  CartInfo,
  CartItem,
  Collection,
  Connection,
  Image,
  Menu,
  Page,
  Product,
  RemoveFromCartOperationParams,
  ShopifyCollection,
  ShopifyProduct,
  UpdateCartOperationParams
} from './types';

const domain = process.env.SHOPIFY_STORE_DOMAIN
  ? ensureStartsWith(process.env.SHOPIFY_STORE_DOMAIN, 'https://')
  : '';
const endpoint = `${domain}${SHOPIFY_GRAPHQL_API_ENDPOINT}`;
const key = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!;

type ExtractVariables<T> = T extends { variables: object } ? T['variables'] : never;

export async function apiFetch<T>({
  cache = 'force-cache',
  headers,
  query,
  tags,
  variables
}: {
  cache?: RequestCache;
  headers?: HeadersInit;
  query: string;
  tags?: string[];
  variables?: ExtractVariables<T>;
}): Promise<{ status: number; body: T } | never> {
  try {
    const result = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        ...(query && { query }),
        ...(variables && { variables })
      }),
      cache,
      ...(tags && { next: { tags } })
    });

    const body = await result.json();

    if (body.errors) {
      throw body.errors[0];
    }

    return {
      status: result.status,
      body
    };
  } catch (e) {
    throw {
      error: e,
      query
    };
  }
}

const removeEdgesAndNodes = <T>(array: Connection<T>): T[] => {
  return array.edges.map((edge) => edge?.node);
};

const reshapeCart = (cart: CartInfo): Cart => {
  if (!cart.cost?.totalTaxAmount) {
    cart.cost.totalTaxAmount = {
      amount: '0.0',
      currencyCode: 'USD'
    };
  }

  return {
    ...cart,
    lines: removeEdgesAndNodes(cart.lines)
  };
};

const reshapeCollection = (collection: ShopifyCollection): Collection | undefined => {
  if (!collection) {
    return undefined;
  }

  return {
    ...collection,
    path: `/search/${collection.id}`
  };
};

const reshapeCollections = (collections: ShopifyCollection[]) => {
  const reshapedCollections = [];

  for (const collection of collections) {
    if (collection) {
      const reshapedCollection = reshapeCollection(collection);

      if (reshapedCollection) {
        reshapedCollections.push(reshapedCollection);
      }
    }
  }

  return reshapedCollections;
};

const reshapeImages = (images: Connection<Image>, productTitle: string) => {
  const flattened = removeEdgesAndNodes(images);

  return flattened.map((image) => {
    const filename = image.url.match(/.*\/(.*)\..*/)?.[1];
    return {
      ...image,
      altText: image.altText || `${productTitle} - ${filename}`
    };
  });
};

const reshapeProduct = (product: ShopifyProduct, filterHiddenProducts: boolean = true) => {
  if (!product || (filterHiddenProducts && product.tags.includes(HIDDEN_PRODUCT_TAG))) {
    return undefined;
  }

  const { images, variants, ...rest } = product;

  return {
    ...rest,
    images: reshapeImages(images, product.title),
    variants: removeEdgesAndNodes(variants)
  };
};

const reshapeProducts = (products: ShopifyProduct[]) => {
  const reshapedProducts = [];

  for (const product of products) {
    if (product) {
      const reshapedProduct = reshapeProduct(product);

      if (reshapedProduct) {
        reshapedProducts.push(reshapedProduct);
      }
    }
  }

  return reshapedProducts;
};

export async function createCart(): Promise<Cart> {
  // Add logic

  return cartList[0] as Cart;
}

export async function addToCart(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  // Add logic to add to cart
  let myCart: Cart = cartList.find((cart) => cart.id === cartId) as Cart;

  if (!myCart) return {} as Cart;

  let newItems: CartItem[] = [];

  lines.forEach((line) => {
    newItems.push({
      id: 'line1',
      quantity: 1,
      cost: {
        totalAmount: {
          amount: '50.00',
          currencyCode: 'USD'
        }
      },
      merchandise: {
        id: line.merchandiseId,
        title: 'Product 1',
        selectedOptions: [
          {
            name: 'Size',
            value: 'M'
          },
          {
            name: 'Color',
            value: 'Red'
          }
        ],
        product: {
          id: 'prod1',
          handle: 'product-1',
          title: 'Product 1',
          featuredImage: {
            url: '/assets/images/t-shirt-2.png',
            altText: 'Product 1 Image',
            width: 600,
            height: 400
          }
        }
      }
    });

    myCart.lines = [...myCart.lines, ...newItems];
  });

  return myCart;
}

export async function removeFromCart(cartId: string, lineIds: string[]): Promise<Cart> {
  const res = await apiFetch<RemoveFromCartOperationParams>({
    query: removeFromCartMutation,
    variables: {
      cartId,
      lineIds
    },
    cache: 'no-store'
  });

  return reshapeCart(res.body.data.cartLinesRemove.cart);
}

export async function updateCart(
  cartId: string,
  lines: { id: string; merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const res = await apiFetch<UpdateCartOperationParams>({
    query: editCartItemsMutation,
    variables: {
      cartId,
      lines
    },
    cache: 'no-store'
  });

  return reshapeCart(res.body.data.cartLinesUpdate.cart);
}

export async function getCart(cartId: string | undefined): Promise<Cart | undefined> {
  if (!cartId) {
    return undefined;
  }

  return cartList[0];
}

export async function getCollection(id: string): Promise<Collection | undefined> {
  return collectionList[0];
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  const exampleProducts: Product[] = productList;

  return exampleProducts; // reshapeProducts(removeEdgesAndNodes(res.body.data.collection.products));
}

export async function getCollections(): Promise<Collection[]> {
  return collectionList;
}

export async function getMenu(id: string): Promise<Menu[]> {
  return categoryList;
}

export async function getPage(id: string): Promise<Page> {
  return {
    id: 'page1',
    title: 'Welcome to Our Website',
    handle: 'welcome-page',
    body: '<p>Welcome to our website! We are glad to have you here.</p><p>Explore our products and services.</p>',
    bodySummary: 'Welcome to our website! Explore our products and services.',
    seo: {
      title: 'Welcome to Our Website - Our Company',
      description:
        'Discover our company and what we offer. Explore our products and services and get to know us better.'
    },
    createdAt: '2024-08-13T12:00:00Z',
    updatedAt: '2024-08-13T12:00:00Z'
  };
}

export async function getPages(): Promise<Page[]> {
  return [
    {
      id: 'page1',
      title: 'Welcome to Our Website',
      handle: 'welcome-page',
      body: '<p>Welcome to our website! We are glad to have you here.</p><p>Explore our products and services.</p>',
      bodySummary: 'Welcome to our website! Explore our products and services.',
      seo: {
        title: 'Welcome to Our Website - Our Company',
        description:
          'Discover our company and what we offer. Explore our products and services and get to know us better.'
      },
      createdAt: '2024-08-13T12:00:00Z',
      updatedAt: '2024-08-13T12:00:00Z'
    }
  ];
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return productList.find((product) => product.id === id);
}

export async function getProductRecommendations(productId: string): Promise<Product[]> {
  const product = productList.filter((product) => product.id !== productId);

  return product;
}

export async function getProducts({
  query,
  reverse,
  sortKey
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  console.log('query', query);
  const exampleProducts: Product[] = productList;

  return exampleProducts;
}

// This is called from `app/api/revalidate.ts` so providers can control revalidation logic.
export async function revalidate(req: NextRequest): Promise<NextResponse> {
  // We always need to respond with a 200 status code to Shopify,
  // otherwise it will continue to retry the request.
  const collectionWebhooks = ['collections/create', 'collections/delete', 'collections/update'];
  const productWebhooks = ['products/create', 'products/delete', 'products/update'];
  const topic = headers().get('x-shopify-topic') || 'unknown';
  const secret = req.nextUrl.searchParams.get('secret');
  const isCollectionUpdate = collectionWebhooks.includes(topic);
  const isProductUpdate = productWebhooks.includes(topic);

  if (!secret || secret !== process.env.SHOPIFY_REVALIDATION_SECRET) {
    console.error('Invalid revalidation secret.');
    return NextResponse.json({ status: 200 });
  }

  if (!isCollectionUpdate && !isProductUpdate) {
    // We don't need to revalidate anything for any other topics.
    return NextResponse.json({ status: 200 });
  }

  if (isCollectionUpdate) {
    revalidateTag(TAGS.collections);
  }

  if (isProductUpdate) {
    revalidateTag(TAGS.products);
  }

  return NextResponse.json({ status: 200, revalidated: true, now: Date.now() });
}
