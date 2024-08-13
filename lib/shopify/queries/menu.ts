export const getMenuQuery = /* GraphQL */ `
  query getMenu($id: String!) {
    menu(id: $id) {
      items {
        title
        url
      }
    }
  }
`;
