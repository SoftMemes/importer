import { Client } from '@notionhq/client'
import { Book } from '../book'

const makeText = (text: string) => ({
  rich_text: [
    {
      text: {
        content: text,
      },
    },
  ],
})

const makeTitle = (title: string) => ({
  title: [
    {
      text: {
        content: title,
      },
    },
  ],
})

const makeSelect = (name: string) => ({
  select: {
    name,
  },
})

const makeMultiSelect = (names: string[]) => ({
  multi_select: names.map(name => ({
    name,
  })),
})

const makeDate = (date: string) => ({
  date: {
    start: date,
  },
})

const sanitizeDate = (date: string) => {
  const dateBits = date.split('-')

  if (dateBits.length === 3) {
    return date
  } else if (dateBits.length === 2) {
    return `${dateBits[0]}-${dateBits[1]}-01`
  } else if (dateBits.length === 1) {
    return `${dateBits[0]}-01-01`
  } else {
    throw new Error('Invalid date: ' + date)
  }
}

const sanitizeCategory = (category: string) => category.replace(',', '-')

// TODO: This picks the first shared DB regardless of shape, hacky hacky
const getFirstDatabaseId = async (notionClient: Client) => {
  const dbResult = await notionClient.search({
    filter: { property: 'object', value: 'database' },
  })

  if (dbResult.results.length) {
    return dbResult.results[0].id
  } else {
    throw new Error('No databases found')
  }
}

export const registerBook = async (
  book: Book,
  accessToken: string,
): Promise<boolean> => {
  const client = new Client({
    auth: accessToken,
  })

  const databaseId = await getFirstDatabaseId(client)
  const existing = await client.databases.query({
    database_id: databaseId,
    filter: { property: 'ISBN', rich_text: { equals: book.isbn } },
  })

  const properties = {
    Title: makeTitle(book.title),
    ISBN: makeText(book.isbn),
    Publisher: book.publisher ? makeSelect(book.publisher) : undefined,
    Authors: makeMultiSelect(book.authors),
    Description: book.description ? makeText(book.description) : undefined,
    Categories: book.categories
      ? makeMultiSelect(
          book.categories.map(category => sanitizeCategory(category)),
        )
      : undefined,
    'Published Date': makeDate(sanitizeDate(book.publishedDate)),
    Language: makeSelect(book.language),
  }

  if (existing.results.length) {
    await client.pages.update({
      page_id: existing.results[0].id,
      // NOTE: Type definitions are somehow not working, much weirdness
      properties: properties as any,
      icon: book.thumbnailUrl
        ? { external: { url: book.thumbnailUrl } }
        : undefined,
    })
    return false
  } else {
    await client.pages.create({
      parent: { database_id: databaseId },
      // NOTE: Type definitions are somehow not working, much weirdness
      properties: properties as any,
      icon: book.thumbnailUrl
        ? { external: { url: book.thumbnailUrl } }
        : undefined,
    })
    return true
  }
}
