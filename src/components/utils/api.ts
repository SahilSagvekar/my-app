// // utils/api.ts
// export async function loginUser(email: string, password: string) {
//   const res = await fetch("/api/login", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({ email, password }),
//   });
//   console.log("utils/api.ts");

//   const data = await res.json();

//   if (!res.ok) {
//     throw new Error(data.message || "Login failed");
//   }

//   return data; // { token, user: { email, role } }
// }
