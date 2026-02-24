export const cartRelations = {
  include: {
    items: {
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            storeId: true,
            basePrice: true,
            comparePrice: true,
            isDeleted: true,
            store: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            media: {
              where: {
                isPrimary: true
              },
              select: {
                mediaUrl: true
              },
              take: 1
            }
          }
        },
        variant: {
          select: {
            id: true,
            sku: true,
            price: true,
            comparePrice: true,
            imageUrl: true,
            variantAttributes: {
              include: {
                attributeValue: {
                  include: {
                    attribute: true
                  }
                }
              }
            },
            inventories: {
              select: {
                id: true,
                quantity: true,
                reservedQty: true,
                branch: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
