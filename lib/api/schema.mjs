
export default {
  createUser: {
    params: {
      userId: { type: 'integer' }
    },
    body: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'integer' },
        username: { type: 'string', maxLength: 32 },
        avatar: { type: 'string', maxLength: 50 },
        discriminator: { type: 'string', maxLength: 5 },
        email: { type: 'string', format: 'email' },
        verified: { type: 'boolean' },
        locale: { type: 'string', maxLength: 2 }
      },
      required: ['id', 'username']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          userId: { type: 'integer' }
        }
      }
    }
  },
  searchUsers: {
    query: {
      type: 'object',
      additionalProperties: false,
      properties: {
        offset: { type: 'integer', minimum: 0, default: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 40, default: 10 }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                username: { type: 'string', maxLength: 32 },
                visits: {
                  type: 'array',
                  items: {
                    type: 'string',
                    format: 'date-time'
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
