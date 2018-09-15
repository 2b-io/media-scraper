import fetch from 'node-fetch'
import mime from 'mime'
import ms from 'ms'
import normalizeUrl from 'normalize-url'
import { URL } from 'url'

import config from 'infrastructure/config'
import s3 from 'infrastructure/s3'

import safeHandler from 'utils/safe-handler'

export default safeHandler(
  async (event) => {
    const body = JSON.parse(event.body)

    const { url, key } = body

    const headers = body.headers
      .filter(Boolean)
      .filter(
        ({ name, value }) => !!(name && value)
      )
      .reduce(
        (headers, { name, value }) => ({
          ...headers,
          [ name ]: value
        }), {}
      )

    const u = new URL(normalizeUrl(url, {
      stripWWW: false
    }))

    const media = await fetch(u.toString(), {
      headers
    })

    if (!media.ok) {
      throw media.statusText
    }

    const responseHeaders = media.headers.raw()

    const contentType = responseHeaders['content-type'] && responseHeaders['content-type'][0]

    const file = {}

    file.contentType = contentType ?
      contentType.split(';').shift() :
      mime.getType(u.pathname)

    if (file.contentType) {
      file.ext = mime.getExtension(contentType)
    }

    const buffer = await media.buffer()

    const upload = await s3.upload({
      Bucket: config.aws.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: file.contentType || 'application/octet-stream',
      CacheControl: `max-age=${ ms('7d') / 1000 }`,
      Metadata: {
        'origin-url': u.toString()
      }
    }).promise()

    return {
      body: JSON.stringify({
        ...file,
        meta: upload
      })
    }
  }
)
