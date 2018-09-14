import serrializeError from 'serialize-error'

export default (handler) => async (...args) => {
  try {
    await handler(...args)
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        reason: serrializeError(error)
      })
    }
  }
}
