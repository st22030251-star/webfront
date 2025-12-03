import logo from "../../images/logo-mexico.jpeg"
import "./header.css"

export const Header = () => {
    return (
        <div className="header">
            <img className="header__logo" src={logo} alt="magical mexico" />
            <h1>México Magico</h1>
        </div>
    )
}

export default Header;