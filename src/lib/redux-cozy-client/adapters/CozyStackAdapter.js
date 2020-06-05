/* global cozy */
const FETCH_LIMIT = 50

export default class CozyStackAdapter {
  async fetchApps(skip = 0) {
    const { data, meta } = await cozy.client.fetchJSON('GET', '/apps/', null, {
      processJSONAPI: false
    })

    return {
      data: data || [],
      meta: meta,
      skip,
      next: !!meta && meta.count > skip + FETCH_LIMIT
    }
  }

  async fetchDocuments(doctype) {
    // WARN: cozy-client-js lacks a cozy.data.findAll method that uses this route
    try {
      // WARN: if no document of this doctype exist, this route will return a 404,
      // so we need to try/catch and return an empty response object in case of a 404
      const resp = await cozy.client.fetchJSON(
        'GET',
        `/data/${doctype}/_all_docs?include_docs=true`
      )
      // WARN: the JSON response from the stack is not homogenous with other routes (offset? rows? total_rows?)
      // see https://github.com/cozy/cozy-stack/blob/master/docs/data-system.md#list-all-the-documents
      // WARN: looks like this route returns something looking like a couchDB design doc, we need to filter it:
      const rows = resp.rows.filter(row => !row.doc.hasOwnProperty('views'))
      // we normalize the data (note that we add _type so that cozy.client.data.listReferencedFiles works...)
      const docs = rows.map(row =>
        Object.assign({}, row.doc, { id: row.id, _type: doctype })
      )
      // we forge a correct JSONAPI response:
      return {
        data: docs,
        meta: { count: resp.total_rows },
        skip: resp.offset,
        next: false
      }
    } catch (error) {
      if (error.message.match(/not_found/)) {
        return { data: [], meta: { count: 0 }, skip: 0, next: false }
      }
      throw error
    }
  }

  init(config) {
    this.config = { ...config }
  }

  createIndex(doctype, fields) {
    return cozy.client.data.defineIndex(doctype, fields)
  }

  async fetchKonnectors(skip = 0) {
    const { data, meta } = await cozy.client.fetchJSON(
      'GET',
      `/konnectors/`,
      null,
      {
        processJSONAPI: false
      }
    )

    return {
      data: data
        ? data.map(konnector => ({
            ...konnector,
            ...konnector.attributes,
            _type: 'io.cozy.konnectors'
          }))
        : [],
      meta: meta,
      skip,
      next: !!meta && meta.count > skip + FETCH_LIMIT
    }
  }

  async fetchTriggers(worker, skip = 0) {
    const { data, meta } = await cozy.client.fetchJSON(
      'GET',
      `/jobs/triggers?Worker=${worker}`,
      null,
      {
        processJSONAPI: false
      }
    )

    return {
      data: data
        ? data.map(trigger => ({
            ...trigger,
            ...trigger.attributes,
            _type: 'io.cozy.triggers'
          }))
        : [],
      meta: meta,
      skip,
      next: !!meta && meta.count > skip + FETCH_LIMIT
    }
  }
}
