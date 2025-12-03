import './profile.css'
import avatar from "../../images/perfil.jpg"

function Profile() {
    return (
        <section className="traveler-profile site__section">
            <img
                className="traveler-profile__image"
                src={avatar}
                alt="Avatar"
            />
            <div className="traveler-profile__details">
                <h1 className="traveler-profile__name" id="h1temp">Jesus Eduardo XD</h1>
                <button
                    aria-label="Edit traveler profile"
                    className="traveler-profile__edit-btn"
                    type="button"
                ></button>
                <p className="traveler-profile__bio">PhD in Information Technology</p>
            </div>
            <button
                aria-label="Add new place"
                className="traveler-profile__add-place-btn"
                type="button"
            ></button>
        </section>
    )
}

export default Profile;