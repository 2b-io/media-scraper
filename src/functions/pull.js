import fetch from 'node-fetch'
import mime from 'mime'
import normalizeUrl from 'normalize-url'
import fileType from 'file-type'
import { URL } from 'url'

import config from 'infrastructure/config'
import s3 from 'infrastructure/s3'

import safeHandler from 'utils/safe-handler'

const TIME_SPENT_TO_DETECT_MIME = 500

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

    const type = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(),
        TIME_SPENT_TO_DETECT_MIME
      )
      let shouldHalt = false

      clone.body.on('readable', () => {
        if (shouldHalt) {
          clearTimeout(timeout)

          return
        }

        const chunk = clone.body.read(fileType.minimumBytes)

        if (chunk) {
          const type = fileType(chunk)

          shouldHalt = true
          clone.body.destroy()

          clearTimeout(timeout)

          resolve(type)
        }
      })
    })

    const responseHeaders = media.headers.raw()
    const contentTypeHeader = responseHeaders['content-type'] && responseHeaders['content-type'][0]

    const file = {}

    file.contentType = (type && type.mime) ?
      type.mime.split(';').shift() : (
        contentTypeHeader ?
          contentTypeHeader.split(';').shift() :
          mime.getType(u.pathname)
      )

    file.ext = file.contentType ?
      mime.getExtension(file.contentType) :
      'application/octet-stream'

    const upload = await s3.upload({
      Bucket: config.aws.s3.bucket,
      Key: key,
      Body: media.body,
      ContentType: file.contentType,
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
