const axios = require('axios');
const FormData = require('form-data');

async function test() {
  try {
    const formData = new FormData();
    formData.append('projectId', '1234');
    formData.append('file', Buffer.from('col1,col2\n1,2\n3,4'), 'test.csv');

    const response = await axios.post('http://127.0.0.1:8005/api/datasets/process', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
    console.log("Success:", response.data);
  } catch (err) {
    console.error("Error:", err.message);
    if (err.response) {
      console.error("Data:", err.response.data);
    }
  }
}

test();
