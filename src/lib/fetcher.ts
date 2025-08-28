export const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
