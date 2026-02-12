export const cartRelations = {
  include: {
    items: {
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            comparePrice: true,
            isDeleted: true,
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
            imageUrl: true,
            variantAttributes: {
              include: {
                attributeValue: {
                  include: {
                    attribute: true
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
