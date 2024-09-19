// secret string
// possibly come from process.env/encrypted
const base_url = 'https://airconsole-interview.vercel.app/';
const endpoint = 'api/text/';

(async () => {
    const result = await Promise.all([...Array(200)].map(async (_, index) => fetchCall(index)));
    console.log('~~~ Result', result.join());
})()

async function fetchCall(index) {
    try {
        const response = await fetch(
            `${base_url}${endpoint}${index}`
        );
        if (!response.ok) {
            console.error('Error')
            throw new Error();
        }
        const current = await response.text();
        return current;
    } catch (error) {
        return fetchCall(index);
    }
}