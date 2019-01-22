import fetch from 'node-fetch'
import mime from 'mime'
import normalizeUrl from 'normalize-url'
import fileType from 'file-type'
import { URL } from 'url'

import config from 'infrastructure/config'
import s3 from 'infrastructure/s3'

import safeHandler from 'utils/safe-handler'

export default safeHandler(
  async (event) => {
    const body = JSON.parse(event.body)

    const { url, key, ttl } = body

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

    // clone response to consume its stream
    const clone = await media.clone()

    const {
      ext,
      mime: contentType
    } = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(), 2e3)

      clone.body.once('readable', () => {
        const chunk = clone.body.read(fileType.minimumBytes)
        const type = fileType(chunk)

        // clear things
        clone.body.destroy()
        clearTimeout(timeout)

        resolve(type)
      })
    })

    const file = {}

    file.contentType = contentType ?
      contentType.split(';').shift() :
      mime.getType(u.pathname)

    file.ext = ext || mime.getExtension(file.contentType)

    const upload = await s3.upload({
      Bucket: config.aws.s3.bucket,
      Key: key,
      Body: media.body,
      ContentType: file.contentType || 'application/octet-stream',
      Expires: ttl ? new Date(Date.now() + ttl * 1000) : undefined,
      Metadata: {
        'origin-url': u.toString()
      }
    }).promise()

    return {
      statusCode: 201,
      body: JSON.stringify({
        ...file,
        meta: upload
      })
    }
  }
)
