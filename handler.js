import got from 'got'

export const scrape = async (event) => {
  console.log(event)

  const { queryStringParameters } = event

  console.log(queryStringParameters)

  const response = await got('http://httpbin.org/get', {
    json: true
  })

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html'
    },
    body: `<h1>Hello World from ${ response.body.origin }</h1>`
  }
}
