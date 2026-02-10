// using global FormData
// Better to use native global FormData if available, or just construct the body manually if needed.
// Node 18+ has global FormData.
// Let's assume global.

async function test() {
  try {
    const fd = new FormData();
    fd.append('name', 'Test Node');
    fd.append('email', 'test-node@example.com');
    fd.append('business_name', 'Node Biz');
    fd.append('industry', 'Scripting');
    fd.append('domain_preference', 'I have one');
    fd.append('message', 'Hello from node script');

    const res = await fetch('http://127.0.0.1:8788/api/submit-application', {
      method: 'POST',
      body: fd
    });

    console.log('Status:', res.status);
    console.log('URL:', res.url);
    const text = await res.text();
    console.log('Raw response:', text);

    if (res.ok) {
        console.log("SUCCESS");
    } else {
        console.log("FAILED");
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
