import https from 'https'

const USER_AGENT = 'TuneVault/2.0 (nathanialhenniges@users.noreply.github.com)'

export class MusicBrainzService {
  async lookupReleaseDate(artist: string, title: string): Promise<string | null> {
    const query = `recording:"${title}" AND artist:"${artist}"`
    const url = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=1`

    return new Promise((resolve) => {
      const req = https.get(
        url,
        { headers: { 'User-Agent': USER_AGENT } },
        (res) => {
          let data = ''
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString()
          })
          res.on('end', () => {
            try {
              const json = JSON.parse(data)
              const recordings = json.recordings
              if (recordings && recordings.length > 0) {
                const firstRelease = recordings[0]['first-release-date']
                if (firstRelease) {
                  resolve(firstRelease)
                  return
                }
              }
              resolve(null)
            } catch {
              resolve(null)
            }
          })
        }
      )
      req.on('error', () => resolve(null))
      req.setTimeout(5000, () => {
        req.destroy()
        resolve(null)
      })
    })
  }
}
