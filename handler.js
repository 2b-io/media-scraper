const got = require('got')

module.exports.hello = (event, context, callback) => {
  console.log(event)

  callback(null, {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html'
    },
    body: '<h1>Hello World</h1>'
  })
}
