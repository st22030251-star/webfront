import './card.css';
import apis from '../../data/class';

function Card({ props, deleteCard, like }) {
    let card = props
    return (
        <li className="place-card">
            <img className="place-card__image" src={card.link} alt="" />
            <button
                aria-label="Remove place"
                className="place-card__delete-button"
                type="button"
                onClick={() => { deleteCard(card) }}
            ></button>
            <div className="place-card__description">
                <h2 className="place-card__title">{card.description}</h2>
                <button
                    aria-label="Like place"
                    className={card.like ? "place-card__like-button place-card__like-button_is-active" : "place-card__like-button"}
                    type="button"
                    onClick={() => { like(card, !props.like) }}
                ></button>
            </div>
        </li>
    );
}

export default Card;