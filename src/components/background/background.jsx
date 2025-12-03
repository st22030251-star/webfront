import './background.css'
function Background({children}){
    return(
        <div className="background">
            {children}
        </div>
    );
}

export default Background;