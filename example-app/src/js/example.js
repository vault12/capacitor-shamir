import { Shamir } from 'capacitor-shamir';

window.testEcho = () => {
    const inputValue = document.getElementById("echoInput").value;
    Shamir.echo({ value: inputValue })
}
